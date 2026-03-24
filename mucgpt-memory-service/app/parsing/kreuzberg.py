import httpx
from fastapi import UploadFile

from config.settings import get_settings
from core.logtools import getLogger
from parsing.base import ParserBackend

logger = getLogger()


class KreuzbergBackend(ParserBackend):
    """Parsing backend that delegates extraction to a remote Kreuzberg service."""

    def __init__(self):
        settings = get_settings()
        self._extract_url = f"{settings.KREUZBERG_URL}/extract"
        self._timeout = settings.KREUZBERG_TIMEOUT
        logger.info(f"KreuzbergBackend configured with URL {settings.KREUZBERG_URL}")

    async def parse(self, file: UploadFile) -> dict:
        file_bytes = await file.read()

        files = {"files": (file.filename, file_bytes, file.content_type)}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self._extract_url, files=files, timeout=self._timeout
            )

        response.raise_for_status()
        return response.json()
