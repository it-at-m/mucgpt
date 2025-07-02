from contextlib import asynccontextmanager

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse

from api.exceptions import AuthenticationException
from api.routers import assistants_router, system_router, users_router
from core.auth import AuthError
from database.session import initialize_database

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

backend.mount("/api/", api_app)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Context manager for the application lifespan.
    It initializes the database on startup.
    """
    await initialize_database()
    yield


backend.lifespan = lifespan


@api_app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
    )


@api_app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    http_exc = AuthenticationException(detail=exc.error, status_code=exc.status_code)
    return await http_exception_handler(request, http_exc)
