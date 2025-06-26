from fastapi import APIRouter

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
    return "OK"
