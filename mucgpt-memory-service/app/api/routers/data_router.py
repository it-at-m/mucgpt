from fastapi import APIRouter, HTTPException

from api.routers.parsing_router import file_storage
from core.logtools import getLogger

logger = getLogger()

router = APIRouter()


@router.get(
    "/data/{file_id}",
    summary="Retrieve parsed file content",
    description="Retrieves the extracted text content of a previously parsed file by its UUID.",
    responses={
        200: {"description": "Extracted file content"},
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
