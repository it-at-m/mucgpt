import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from config.settings import ParserBackendType, get_settings
from core.auth import authenticate_user
from core.logtools import getLogger
from parsing.base import ParserBackend
from parsing.factory import get_parser

logger = getLogger()
settings = get_settings()

router = APIRouter(prefix="/v1")
_parser: ParserBackend | None = get_parser()


@router.post(
    "/parse",
    summary="Upload and parse a file",
    description="Uploads a file, extracts its text content via the configured parser backend, and returns the parsed text directly.",
    responses={
        200: {"description": "Parsed text content of the uploaded file"},
        502: {
            "description": "Parser service returned an error (connection error or non-2xx response)"
        },
        503: {
            "description": "Document processing is not enabled (no parser backend configured)"
        },
        504: {"description": "Parser service did not respond in time (timeout)"},
    },
)
async def parse_file(file: UploadFile, user_info=Depends(authenticate_user)) -> str:
    """
    Parses a file using the configured backend and returns the extracted text content.
    """
    if settings.PARSER_BACKEND == ParserBackendType.NONE:
        raise HTTPException(
            status_code=503, detail="Document processing is not enabled."
        )
    logger.info(f"Parsing file '{file.filename}' ({file.size} bytes)")
    try:
        content = await _parser.parse(file)
    except httpx.TimeoutException as exc:
        logger.error(
            f"Timeout while parsing file '{file.filename}': {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=504,
            detail=f"Parser service timed out while processing '{file.filename}'.",
        )
    except (httpx.ConnectError, httpx.NetworkError, httpx.HTTPStatusError) as exc:
        logger.error(
            f"Parser backend error while parsing file '{file.filename}': {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Parser service returned an error while processing '{file.filename}'.",
        )
    logger.info(f"Parsing of file '{file.filename}' finished")
    return content
