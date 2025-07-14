import time

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Request
from fastapi.responses import (
    RedirectResponse,
)

from api.routers import (
    brainstorm_router,
    chat_router,
    simply_router,
    summarize_router,
    system_router,
    tools_router,
)
from config.settings import get_settings
from core.auth_models import AuthError
from core.logtools import getLogger
from init_app import init_departments

logger = getLogger()

# Initialize the application's services and settings.
departments = init_departments()
settings = get_settings()

# serves static files and the api
backend = FastAPI(title="MUCGPT", version=settings.version)
# serves the api
api_app = FastAPI(
    title="MUCGPT-API",
    description="MUCCGPT core API for AI services",
    version=settings.version,
)
backend.mount("/api/", api_app)

api_app.add_middleware(CorrelationIdMiddleware)


api_app.include_router(chat_router.router, prefix="", tags=["chat"])
api_app.include_router(summarize_router.router, prefix="", tags=["summarize"])
api_app.include_router(brainstorm_router.router, prefix="", tags=["brainstorm"])
api_app.include_router(simply_router.router, prefix="", tags=["simply"])
api_app.include_router(system_router.router, prefix="", tags=["system"])
api_app.include_router(tools_router.router, prefix="", tags=["tools"])


@api_app.exception_handler(AuthError)
async def handleAuthError(request, exc: AuthError):
    """
    Exception handler for authentication errors.
    Redirects the user to the unauthorized user redirect URL.
    """
    # return error.error, error.status_code
    return RedirectResponse(
        url=settings.backend.unauthorized_user_redirect_url, status_code=302
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
