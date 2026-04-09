from fastapi import APIRouter, Depends, UploadFile

from core.auth import authenticate_user
from core.logtools import getLogger
from parsing.base import ParserBackend
from parsing.factory import get_parser

logger = getLogger()

router = APIRouter(prefix="/v1")
_parser: ParserBackend = get_parser()


@router.post(
    "/parse",
    summary="Upload and parse a file",
    description="Uploads a file, extracts its text content via the configured parser backend, and returns the parsed text directly.",
    responses={
        200: {"description": "Parsed text content of the uploaded file"},
    },
)
async def parse_file(file: UploadFile, user_info=Depends(authenticate_user)) -> str:
    """
    Parses a file using the configured backend and returns the extracted text content.
    """
    logger.info(f"Parsing file '{file.filename}' ({file.size} bytes)")
    content = await _parser.parse(file)
    logger.info(f"Parsing of file '{file.filename}' finished")
    return content
