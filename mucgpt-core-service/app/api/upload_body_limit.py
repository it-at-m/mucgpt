"""Body-size bound for the image upload endpoint.

Starlette spools multipart bodies to disk without a limit while the upload
handler only bounds the parsed bytes. A request that never declares an honest
``Content-Length`` could therefore fill the container's temporary storage. The
middleware buffers the upload route's body under the configured per-image
limit (plus multipart overhead) before the parser ever sees it, and rejects
anything larger with HTTP 413.
"""

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from config.settings import get_settings
from core.logtools import getLogger

logger = getLogger()

_MULTIPART_OVERHEAD_BYTES = 64 * 1024


class UploadBodyLimitMiddleware:
    """Cap the image upload request body before multipart parsing."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or not scope.get("path", "").endswith("/images")
        ):
            await self.app(scope, receive, send)
            return
        try:
            settings = get_settings().image_input
        except Exception:
            await self.app(scope, receive, send)
            return
        max_bytes = settings.max_upload_bytes + _MULTIPART_OVERHEAD_BYTES

        headers = Headers(scope=scope)
        content_length = headers.get("content-length")
        if content_length is not None and content_length.isdigit():
            if int(content_length) > max_bytes:
                await self._reject(scope, receive, send, max_bytes)
                return
            await self.app(scope, receive, send)
            return

        buffered: list[bytes] = []
        total = 0
        disconnected = False
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                disconnected = True
                break
            body = message.get("body", b"")
            if body:
                total += len(body)
                if total > max_bytes:
                    break
                buffered.append(body)
            if not message.get("more_body"):
                break
        if disconnected:
            return
        if total > max_bytes:
            await self._reject(scope, receive, send, max_bytes)
            return

        index = 0

        async def replay() -> Message:
            nonlocal index
            if index < len(buffered):
                message = {
                    "type": "http.request",
                    "body": buffered[index],
                    "more_body": index < len(buffered) - 1,
                }
                index += 1
                return message
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.app(scope, replay, send)

    async def _reject(
        self, scope: Scope, receive: Receive, send: Send, max_bytes: int
    ) -> None:
        logger.warning("Rejected oversized image upload (limit %s bytes)", max_bytes)
        response = JSONResponse(
            {"detail": "The image exceeds the upload size limit."},
            status_code=413,
        )
        await response(scope, receive, send)
