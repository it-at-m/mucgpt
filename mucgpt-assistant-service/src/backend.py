import time

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse

from api.exceptions import AuthenticationException
from api.routers import assistants_router, system_router, users_router
from core.auth import AuthError
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


# serves static files and the api
backend = FastAPI(title="MUCGPT-Assistant-Service")
api_app = FastAPI(
    title="MUCGPT Assistant Service API",
    description="""
    ## AI Assistant Management API

    This API provides comprehensive management capabilities for AI assistants.
    """,
    version="0.0.1",
    license_info={
        "name": "MIT",
    },
    tags_metadata=[
        {
            "name": "Assistants",
            "description": "Operations for managing AI assistants including creation, updates, and retrieval",
        },
        {
            "name": "Tools",
            "description": "Operations for managing tools that can be used by assistants",
        },
        {
            "name": "Users",
            "description": "User-related operations including ownership queries",
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints",
        },
    ],
)

# Include routers
api_app.include_router(assistants_router)
api_app.include_router(users_router)
api_app.include_router(system_router)
# Add correlation ID middleware for tracking requests
api_app.add_middleware(CorrelationIdMiddleware)

# Mount API
backend.mount("/api/", api_app)


@api_app.middleware("http")
async def add_process_time_header(request: Request, call_next):
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


@api_app.exception_handler(Exception)
async def handle_general_exception(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
    )


@api_app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    http_exc = AuthenticationException(detail=exc.error, status_code=exc.status_code)
    return await http_exception_handler(request, http_exc)
