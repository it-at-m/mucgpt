import uuid

from fastapi import APIRouter, UploadFile

from core.logtools import getLogger
from parsing.base import ParserBackend
from parsing.factory import get_parser

logger = getLogger()

router = APIRouter()
_parser: ParserBackend = get_parser()

# FIXME in-memory "database" to store file content mapped to a UUID
# Shared with data_router via module-level reference
file_storage: dict[str, str] = {}


@router.post(
    "/parse/",
    summary="Upload and parse a file",
    description="Uploads a file, extracts its text content via the configured parser backend, stores it under a generated UUID, and returns that UUID.",
    responses={
        200: {"description": "UUID of the parsed and stored file content"},
    },
)
async def parse_file(file: UploadFile) -> str:
    """
    Parses a file using the configured backend and stores the result. Returns the UUID for later retrieval.
    """
    file_id = str(uuid.uuid4())

    logger.info(f"Parsing file {file_id} ({file.filename}, {file.size} bytes)")
    processed_content = await _parser.parse(file)
    logger.info(f"Parsing of file {file_id} finished")

    file_storage[file_id] = processed_content

    return file_id
