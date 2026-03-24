from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from api.routers import data_router, parsing_router, system_router
from config.settings import get_settings
from core.logtools import getLogger

logger = getLogger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MUCGPT Memory Service")
    logger.info("Loaded Settings:\n%s", settings.model_dump_json(indent=2))
    yield


backend = FastAPI(
    title="MUCGPT Memory Service",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

api_app = FastAPI(
    title="MUCGPT Memory API",
    description="MUCGPT memory service API for file upload and extraction",
    version=settings.APP_VERSION,
    openapi_tags=[
        {
            "name": "Parsing",
            "description": "Operations for uploading and parsing files via Kreuzberg",
        },
        {
            "name": "Data",
            "description": "Operations for retrieving previously parsed file content",
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints",
        },
    ],
)

backend.mount("/api/", api_app)

api_app.include_router(parsing_router.router, prefix="", tags=["Parsing"])
api_app.include_router(data_router.router, prefix="", tags=["Data"])
api_app.include_router(system_router.router, prefix="", tags=["System"])


@api_app.exception_handler(httpx.HTTPStatusError)
async def upstream_http_error_handler(
    request: Request, exc: httpx.HTTPStatusError
) -> JSONResponse:
    logger.error(f"Upstream HTTP error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Upstream service error: {exc.response.status_code}"},
    )
