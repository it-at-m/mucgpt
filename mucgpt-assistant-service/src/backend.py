from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from sqlalchemy import URL
from sqlalchemy.ext.asyncio import create_async_engine

from api.exceptions import AuthenticationException
from api.routers import assistants_router, system_router, users_router
from config.configuration import ConfigHelper
from core.auth import AuthError
from database.assistant_repo import AssistantRepository
from database.database_models import Base
from database.session import get_db_session

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

backend.mount("/api/", api_app)


@backend.on_event("startup")  # TODO: remove for production?!
async def on_startup():
    config_helper = ConfigHelper()
    config = config_helper.loadData()
    db_config = config.backend.db_config
    url = URL.create(
        drivername="postgresql+asyncpg",
        username=db_config.db_user,
        password=db_config.db_password,
        host=db_config.db_host,
        database=db_config.db_name,
    )
    engine = create_async_engine(url=url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

    for assistant_data in config.community_assistants:
        async for db in get_db_session():
            assistant_repo = AssistantRepository(db)

            new_assistant = await assistant_repo.create([], owner_ids=[])
            new_assistant.id = assistant_data.id  # Set the ID from the config
            # Create the first version with the actual assistant data
            # Replace escaped newlines with actual newlines
            assistant_data.system_message = assistant_data.system_message.replace(
                "\\n", "\n"
            )
            # Remove surrounding quotes if present
            if assistant_data.system_message.startswith(
                '"'
            ) and assistant_data.system_message.endswith('"'):
                assistant_data.system_message = assistant_data.system_message[1:-1]
            # Replace escaped newlines and double spaces in description
            assistant_data.description = assistant_data.description.replace(
                "\\n", "\n"
            ).replace("  ", "  \n")
            if assistant_data.description.startswith(
                '"'
            ) and assistant_data.description.endswith('"'):
                assistant_data.description = assistant_data.description[1:-1]
            await assistant_repo.create_assistant_version(
                new_assistant,
                name=assistant_data.title,
                description=assistant_data.description or "",
                system_prompt=assistant_data.system_message,
                temperature=assistant_data.temperature,
                max_output_tokens=assistant_data.max_output_tokens,
                examples=assistant_data.examples or [],
                quick_prompts=assistant_data.quick_prompts or [],
                tags=[],
            )
            await db.commit()
            await db.refresh(new_assistant)
            break  # Only need one session per assistant


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
