from contextlib import asynccontextmanager

from api.routers import data_router, system_router
from config.settings import get_settings
from core.logtools import getLogger
from fastapi import FastAPI

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
            "name": "Data",
            "description": "Operations for uploading and retrieving extracted file content",
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints",
        },
    ],
)

backend.mount("/api/", api_app)

api_app.include_router(data_router.router, prefix="", tags=["Data"])
api_app.include_router(system_router.router, prefix="", tags=["System"])
