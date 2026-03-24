import httpx
from config.settings import get_settings
from core.logtools import getLogger
from fastapi import UploadFile

logger = getLogger()


class Kreuzberg:
    def __init__(self):
        settings = get_settings()
        self._extract_url = f"{settings.KREUZBERG_URL}/extract"
        logger.info(f"Using KREUZBERG_URL {settings.KREUZBERG_URL}")

    async def process_data(self, file: UploadFile) -> dict:
        file_bytes = await file.read()

        files = {"files": (file.filename, file_bytes, file.content_type)}

        async with httpx.AsyncClient() as client:
            response = await client.post(self._extract_url, files=files, timeout=2 * 60)

        response.raise_for_status()
        return response.json()
