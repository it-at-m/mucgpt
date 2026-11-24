import json

import httpx
from anyio import to_thread
from fastapi import UploadFile

from config.settings import get_settings
from core.logtools import getLogger
from parsing.base import ParserBackend

logger = getLogger()


class XbergBackend(ParserBackend):
    """Parsing backend that delegates extraction to a remote Xberg service."""

    def __init__(self):
        settings = get_settings()
        self._extract_url = f"{settings.xberg_url.rstrip('/')}/extract"
        self._timeout = settings.xberg_timeout
        logger.info(f"XbergBackend configured with URL {settings.xberg_url}")

    async def parse(self, file: UploadFile) -> str:
        """Extract text; callers own the wall-clock deadline (upload or /parse)."""
        max_response_bytes = get_settings().documents.parser_response_max_bytes
        file_bytes = await file.read()

        # Use a list-of-tuples for multipart fields so repeated "files" is supported.
        files = [
            (
                "files",
                (
                    file.filename,
                    file_bytes,
                    file.content_type or "application/octet-stream",
                ),
            )
        ]

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST", self._extract_url, files=files, timeout=self._timeout
            ) as response:
                response.raise_for_status()
                response_body = bytearray()
                async for chunk in response.aiter_bytes():
                    response_body.extend(chunk)
                    if len(response_body) > max_response_bytes:
                        raise ValueError("Xberg response exceeds the byte limit")

        # Off the event loop, but not abandoned on cancellation: the response cap
        # bounds this work, and abandoned threads would pile up after timeouts.
        payload = await to_thread.run_sync(json.loads, response_body)
        return await to_thread.run_sync(_extract_text, payload)


def _extract_text(payload: object) -> str:
    """Accept both Xberg response formats."""

    # Xberg >= 1.0 returns {"results": [...], "errors": [...], "summary": {...}}.
    if isinstance(payload, dict):
        results = payload.get("results", [])
        errors = payload.get("errors") or []
        if errors:
            logger.warning("Xberg reported extraction errors: %s", errors)
    elif isinstance(payload, list):
        # Backward compatibility with older list-shaped responses.
        results = payload
    else:
        logger.warning("Unexpected Xberg response shape: %s", type(payload).__name__)
        results = []

    return "\n\n".join(r["content"] for r in results if r.get("content"))
