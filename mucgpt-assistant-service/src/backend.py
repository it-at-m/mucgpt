from typing import List

from fastapi import Depends, FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api.api_models import (
    AssistantCreate,
    AssistantResponse,
    AssistantUpdate,
    AssistantVersionResponse,
)
from api.exceptions import (
    AssistantNotFoundException,
    AuthenticationException,
    DeleteFailedException,
    NotAllowedToAccessException,
    NotOwnerException,
    NoVersionException,
    VersionConflictException,
)
from core.auth import AuthError, authenticate_user
from core.auth_models import AuthenticationResult
from database.assistant_repo import AssistantRepository
from database.database_models import AssistantTool, Owner, Tool
from database.repo import Repository
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
backend.mount("/api/", api_app)


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


@api_app.post(
    "/bot/create",
    response_model=AssistantResponse,
    summary="Create a new AI assistant",
    description="""
    Create a new AI assistant with specified configuration, tools, and owners.

    """,
    responses={
        200: {"description": "The created assistant with all associated data"},
        401: {"description": "Unauthorized"},
    },
    tags=["Assistants"],
)
async def createBot(
    assistant: AssistantCreate,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    # Create a new assistant using the repository
    assistant_repo = AssistantRepository(db)

    # Create the assistant with basic properties
    new_assistant = assistant_repo.create(
        name=assistant.name,
        description=assistant.description,
        system_prompt=assistant.system_prompt,
    )

    # Add tools if specified
    if assistant.tools:
        tool_repo = Repository(Tool, db)
        for tool_data in assistant.tools:
            tool = tool_repo.session.query(Tool).filter(Tool.id == tool_data.id).first()
            if not tool:
                tool = Tool(id=tool_data.id)
                db.add(tool)

            assistant_tool = AssistantTool(
                assistant=new_assistant, tool=tool, config=tool_data.config
            )
            db.add(assistant_tool)

    # Add owner_ids if specified, and ensure the creating user is always an owner
    owner_ids = list(assistant.owner_ids) if assistant.owner_ids else []

    # Add the user's lhmobjektid if not already present
    if user_info.lhm_object_id not in owner_ids:
        owner_ids.append(user_info.lhm_object_id)

    if owner_ids:
        owner_repo = Repository(Owner, db)
        for owner_id in owner_ids:
            # Get or create the Owner
            owner = (
                owner_repo.session.query(Owner)
                .filter(Owner.lhmobjektID == owner_id)
                .first()
            )
            if not owner:
                owner = Owner(lhmobjektID=owner_id)
                owner_repo.session.add(owner)
            new_assistant.owners.append(owner)

    # Commit changes
    db.commit()
    db.refresh(new_assistant)

    return new_assistant


@api_app.post(
    "/bot/{id}/delete",
    response_model=dict,
    summary="Delete an AI assistant",
    description="""
    Delete an existing AI assistant. Only owners of the assistant can delete it.

    **Security:**
    - Requires authentication
    - Only owners can delete assistants
    - Cascading delete removes all associations

    **Note:** This action is irreversible.
    """,
    tags=["Assistants"],
    responses={
        200: {"description": "Confirmation message of successful deletion"},
        401: {"description": "Unauthorized"},
        403: {"description": "User is not an owner of the assistant"},
        404: {"description": "Assistant not found"},
        500: {"description": "Failed to delete the assistant"},
    },
)
async def deleteBot(
    id: int,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_owner(user_info.lhm_object_id):
        raise NotOwnerException()

    success = assistant_repo.delete(id)

    if not success:
        raise DeleteFailedException(id)

    return {"message": f"Assistant with ID {id} successfully deleted"}


@api_app.post(
    "/bot/{id}/update",
    response_model=AssistantResponse,
    summary="Update an AI assistant",
    description="""
    Update an existing AI assistant's configuration, tools, or owners.

    **Security:**
    - Requires authentication
    - Only owners can update assistants

    **Note:** When updating tools or owners, the entire list is replaced.
    """,
    tags=["Assistants"],
    responses={
        200: {"description": "The updated assistant with all current data"},
        401: {"description": "Unauthorized"},
        403: {"description": "User is not an owner of the assistant"},
        404: {"description": "Assistant not found"},
        409: {"description": "Version conflict detected"},
        500: {"description": "Assistant has no versions and cannot be updated"},
    },
)
async def updateBot(
    id: int,
    assistant_update: AssistantUpdate,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_owner(user_info.lhm_object_id):
        raise NotOwnerException()

    latest_version = assistant.latest_version
    if not latest_version:
        raise NoVersionException()

    if assistant_update.version != latest_version.version:
        raise VersionConflictException(assistant_update.version, latest_version.version)

    # Handle global properties
    if assistant_update.hierarchical_access is not None:
        assistant.hierarchical_access = assistant_update.hierarchical_access

    if assistant_update.owner_ids is not None:
        assistant.owners.clear()
        owner_repo = Repository(Owner, db)
        for owner_id in assistant_update.owner_ids:
            owner = (
                owner_repo.session.query(Owner)
                .filter(Owner.lhmobjektID == owner_id)
                .first()
            )
            if not owner:
                owner = Owner(lhmobjektID=owner_id)
                db.add(owner)
            assistant.owners.append(owner)

    # Create a new version with updated data
    latest_version = assistant.latest_version
    if not latest_version:
        raise NoVersionException()

    version_data = {
        "name": latest_version.name,
        "description": latest_version.description,
        "system_prompt": latest_version.system_prompt,
        "temperature": latest_version.temperature,
        "max_output_tokens": latest_version.max_output_tokens,
        "examples": latest_version.examples,
        "quick_prompts": latest_version.quick_prompts,
        "tags": latest_version.tags,
    }

    update_payload = assistant_update.dict(exclude_unset=True)
    for key, value in update_payload.items():
        if key in version_data:
            version_data[key] = value

    new_version = assistant_repo.create_assistant_version(assistant, **version_data)

    # Handle tools for the new version
    if assistant_update.tools is not None:
        tool_repo = Repository(Tool, db)
        for tool_data in assistant_update.tools:
            tool = tool_repo.session.query(Tool).filter(Tool.id == tool_data.id).first()
            if not tool:
                tool = Tool(id=tool_data.id)
                db.add(tool)

            assistant_tool = AssistantTool(
                assistant_version=new_version, tool=tool, config=tool_data.config
            )
            db.add(assistant_tool)

    db.commit()
    db.refresh(assistant)

    return assistant


@api_app.get(
    "/bot",
    response_model=List[AssistantResponse],
    summary="Get all accessible assistants",
    description="""
    Retrieve all AI assistants that the current user has access to based on their department
    and organizational hierarchy.

    """,
    responses={
        200: {"description": "List of all accessible assistants"},
        401: {"description": "Unauthorized"},
    },
    tags=["Assistants"],
)
async def getAllBots(
    db: Session = Depends(get_db_session), user_info=Depends(authenticate_user)
):
    assistant_repo = AssistantRepository(db)
    assistants = assistant_repo.get_all_possible_assistants_for_user_with_department(
        user_info.department
    )
    return assistants


@api_app.get(
    "/bot/{id}",
    response_model=AssistantResponse,
    summary="Get a specific assistant",
    description="""
    Retrieve detailed information about a specific AI assistant by its ID.

    """,
    tags=["Assistants"],
    responses={
        200: {"description": "Detailed information about the requested assistant"},
        401: {"description": "Unauthorized"},
        404: {"description": "Assistant not found"},
    },
)
async def getBot(
    id: int,
    db: Session = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_allowed_for_user(user_info.department):
        raise NotAllowedToAccessException(id)

    return assistant


@api_app.get(
    "/user/{lhmobjekt_id}/bots",
    response_model=List[AssistantResponse],
    summary="Get assistants owned by a specific user",
    description="""
    Retrieve all AI assistants where the specified lhmobjektID is listed as an owner.

    """,
    responses={
        200: {"description": "List of assistants owned by the specified user"},
        401: {"description": "Unauthorized"},
    },
    tags=["Assistants", "Users"],
)
async def getUserBots(
    db: Session = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Get all assistants where the specified lhmobjektID is an owner."""
    # Get all assistants where this lhmobjektID is an owner
    assistant_repo = AssistantRepository(db)
    assistants = assistant_repo.get_assistants_by_owner(user_info.lhm_object_id)

    return assistants


@api_app.get(
    "/bot/{id}/version/{version}",
    response_model=AssistantVersionResponse,
    summary="Get a specific version of an AI assistant",
    description="""
    Retrieve a specific version of an existing AI assistant.

    **Security:**
    - Requires authentication
    - User must have access to the assistant
    """,
    tags=["Assistants"],
    responses={
        200: {"description": "The requested assistant version"},
        401: {"description": "Unauthorized"},
        403: {"description": "User is not allowed to access the assistant"},
        404: {"description": "Assistant or version not found"},
    },
)
async def get_assistant_version(
    id: int,
    version: int,
    db: Session = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_allowed_for_user(user_info.lhm_department):
        raise NotAllowedToAccessException()

    assistant_version = assistant_repo.get_assistant_version(id, version)

    if not assistant_version:
        raise NoVersionException(id, version)

    return assistant_version


@api_app.get(
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
