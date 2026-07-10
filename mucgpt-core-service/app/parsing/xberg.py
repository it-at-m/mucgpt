import httpx
from fastapi import UploadFile

from config.settings import get_settings
from core.logtools import getLogger
from parsing.base import ParserBackend

logger = getLogger()


class XbergBackend(ParserBackend):
    """Parsing backend that delegates extraction to a remote Xberg service."""

    def __init__(self):
        settings = get_settings()
        self._extract_url = f"{settings.XBERG_URL.rstrip('/')}/extract"
        self._timeout = settings.XBERG_TIMEOUT
        logger.info(f"XbergBackend configured with URL {settings.XBERG_URL}")

    async def parse(self, file: UploadFile) -> str:
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
            response = await client.post(
                self._extract_url, files=files, timeout=self._timeout
            )

        if response.is_error:
            logger.error(
                "Xberg returned status %s for %s. Response body: %s",
                response.status_code,
                self._extract_url,
                response.text,
            )

        response.raise_for_status()

        payload = response.json()

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
            logger.warning(
                "Unexpected Xberg response shape: %s", type(payload).__name__
            )
            results = []

        return "\n\n".join(r["content"] for r in results if r.get("content"))
