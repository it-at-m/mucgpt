from fastapi import APIRouter

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
