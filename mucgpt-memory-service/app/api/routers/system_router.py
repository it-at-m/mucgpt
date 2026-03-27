from config.settings import get_settings
from core.logtools import getLogger
from fastapi import APIRouter

logger = getLogger()
router = APIRouter()
settings = get_settings()


@router.get(
    "/health",
    summary="Health check",
    description="Returns OK when the service is running.",
    responses={200: {"description": "Service is healthy"}},
)
def health_check() -> str:
    return "OK"
