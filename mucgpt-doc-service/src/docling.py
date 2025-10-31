import os

import httpx
from fastapi import UploadFile

from core.logtools import getLogger

DOCLING_URL = os.getenv("DOCLING_URL")
DOCLING_CONVERT_URL = f"{DOCLING_URL}/v1/convert/file"
TIMEOUT = 2*60

logger = getLogger()

class Docling:
    def __init__(self):
        logger.info(f"Using Docling url {DOCLING_URL}")

    @staticmethod
    async def process_doc(file: UploadFile) -> str:
        # Read the uploaded file content
        file_bytes = await file.read()

        # Prepare multipart form data for the outgoing request
        files = {
            "files": (file.filename, file_bytes, file.content_type)
        }
        data = {
            "image_export_mode": "placeholder"
        }

        # Send POST request to Docling
        async with httpx.AsyncClient() as client:
            response = await client.post(DOCLING_CONVERT_URL, data=data, files=files, timeout=TIMEOUT)
        response.raise_for_status()
        response_body = response.json()
        content = response_body["document"]["md_content"]
        return content
