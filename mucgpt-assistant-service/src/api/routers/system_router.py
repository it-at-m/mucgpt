from fastapi import APIRouter

from api.api_models import DirectoryNode
from core.directory_cache import get_simplified_directory_tree
from core.logtools import getLogger

logger = getLogger("system_router")

router = APIRouter()


@router.get(
    "/health",
    summary="Health check endpoint",
    description="""
    Simple health check endpoint to verify that the API service is running and responsive.
    """,
    responses={200: {"description": "Simple OK status message"}},
    tags=["System"],
)
def health_check() -> str:
    logger.info("Health check endpoint called")
    return "OK"


@router.get(
    "/directory",
    summary="Get organization directory tree",
    description="Returns a simplified organization directory tree with shortname, name, and children.",
    response_model=list[DirectoryNode],
    responses={200: {"description": "Successful Response"}},
)
async def get_directory() -> list[DirectoryNode]:
    tree = await get_simplified_directory_tree()
    return [DirectoryNode(**node) for node in tree]
