import time
from contextlib import asynccontextmanager

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from api.routers import (
    chat_router,
    system_router,
    tools_router,
)
from config.settings import (
    get_settings,
)
from core.auth_models import AuthError, AuthErrorResponse
from core.logtools import getLogger
from init_app import destroy_app, warmup_app

logger = getLogger()

# Initialize the application's services and settings.
settings = get_settings()


# setup lifespan hooks
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log current settings
    logger.info("Starting MUCGPT Core Service")
    logger.info("Loaded Settings:\n%s", settings.model_dump_json(indent=2))

    await warmup_app()
    yield
    await destroy_app()


# serves static files and the api
backend = FastAPI(title="MUCGPT", version=settings.VERSION, lifespan=lifespan)
# serves the api
api_app = FastAPI(
    title="MUCGPT-API",
    description="MUCCGPT core API for AI services",
    version=settings.VERSION,
    openapi_tags=[
        {
            "name": "Chat",
            "description": "Operations for managing chat interactions with AI models",
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints",
        },
        {
            "name": "Tools",
            "description": "Operations for managing tools that can be used by assistants",
        },
    ],
)
backend.mount("/api/", api_app)

api_app.add_middleware(CorrelationIdMiddleware)


api_app.include_router(chat_router.router, prefix="", tags=["Chat"])
api_app.include_router(system_router.router, prefix="", tags=["System"])
api_app.include_router(tools_router.router, prefix="", tags=["Tools"])


@api_app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    """
    Exception handler for authentication errors.
    Returns a proper error response with redirect details.
    """
    logger.error(f"Authentication failed: {exc.error}")

    error_body = AuthErrorResponse(
        message=exc.error,
        redirect_url=(settings.UNAUTHORIZED_USER_REDIRECT_URL or None),
    )

    headers = {}
    if settings.UNAUTHORIZED_USER_REDIRECT_URL:
        headers["Location"] = settings.UNAUTHORIZED_USER_REDIRECT_URL

    return JSONResponse(
        status_code=exc.status_code,
        content=error_body.model_dump(exclude_none=True),
        headers=headers,
    )


@api_app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """
    Middleware to add a process time header to each response and log the request duration.
    """
    start_time = time.time()
    response = await call_next(request)
    # add trace information
    if "x-request-id" in response.headers:
        correlation_id.set(response.headers["x-request-id"])
    logger.info(
        "Request %s took %.3f seconds", request.url.path, time.time() - start_time
    )
    # remove trace information
    correlation_id.set(None)
    return response
