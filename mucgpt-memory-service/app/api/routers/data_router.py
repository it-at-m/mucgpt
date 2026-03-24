import uuid
from typing import Dict

from core.logtools import getLogger
from fastapi import APIRouter, HTTPException, UploadFile
from kreuzberg import Kreuzberg

logger = getLogger()

router = APIRouter()
kreuzberg = Kreuzberg()

# FIXME in-memory "database" to store file content mapped to a UUID
file_storage: Dict[str, str] = {}


@router.post(
    "/data/",
    summary="Upload a file",
    description="Uploads a file, extracts its content via Kreuzberg, and returns a unique UUID for later retrieval.",
    responses={
        200: {"description": "UUID of the stored file content"},
    },
)
async def upload_file(file: UploadFile) -> str:
    """
    Uploads a file and returns a unique UUID for retrieval.
    """
    file_id = str(uuid.uuid4())

    logger.info(f"Processing file {file_id} with {file.size} bytes")
    processed_content = await kreuzberg.process_data(file)
    logger.info(f"Processing of file {file_id} finished")

    file_storage[file_id] = processed_content

    return file_id


@router.get(
    "/data/{file_id}",
    summary="Retrieve file content",
    description="Retrieves the extracted text content of a previously uploaded file by its UUID.",
    responses={
        200: {"description": "Extracted file content as a string"},
        404: {"description": "File not found"},
    },
)
async def get_file(file_id: str) -> str:
    """
    Retrieves the content of a file using its UUID.
    """
    logger.info(f"Getting file {file_id}")
    if file_id not in file_storage:
        raise HTTPException(
            status_code=404, detail=f"File with ID '{file_id}' not found"
        )

    return file_storage[file_id]
