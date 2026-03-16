import os
import httpx

from fastapi import UploadFile

from core.logtools import getLogger

KREUZBERG_URL =  os.getenv("KREUZBERG_URL")
KREUZBERG_EXTRACT_URL = f"{KREUZBERG_URL}/extract"
TIMEOUT = 2*60

logger = getLogger()

class Kreuzberg:
    def __init__(self):
        logger.info(f"Using KREUZBERG_URL {KREUZBERG_URL}")

    @staticmethod
    async def process_data(file: UploadFile) -> dict:
        file_bytes = await file.read()

        files = {
            "files": (file.filename, file_bytes, file.content_type)
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(KREUZBERG_EXTRACT_URL, files=files, timeout=TIMEOUT)

        response.raise_for_status()
        print(response.json())
        return response.json()