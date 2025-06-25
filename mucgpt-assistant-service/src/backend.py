from typing import List

from fastapi import Depends, FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

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
    VersionNotFoundException,
)
from core.auth import AuthError, authenticate_user
from core.auth_models import AuthenticationResult
from database.assistant_repo import AssistantRepository
from database.database_models import AssistantTool
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
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):  # Create a new assistant using the repository
    try:
        assistant_repo = AssistantRepository(
            db
        )  # Prepare owner_ids: include the creating user if not already present
        owner_ids = list(assistant.owner_ids) if assistant.owner_ids else []

        if user_info.lhm_object_id not in owner_ids:
            owner_ids.append(user_info.lhm_object_id)

        new_assistant = await assistant_repo.create(
            hierarchical_access=assistant.hierarchical_access or [], owner_ids=owner_ids
        )

        # Create the first version with the actual assistant data
        first_version = await assistant_repo.create_assistant_version(
            new_assistant,
            name=assistant.name,
            description=assistant.description or "",
            system_prompt=assistant.system_prompt,
            temperature=assistant.temperature,
            max_output_tokens=assistant.max_output_tokens,
            examples=assistant.examples or [],
            quick_prompts=assistant.quick_prompts or [],
            tags=assistant.tags or [],
        )  # Add tools if specified
        if assistant.tools:
            for tool_data in assistant.tools:
                # Handle both dictionary and ToolBase objects
                tool_id = (
                    tool_data.get("id") if isinstance(tool_data, dict) else tool_data.id
                )
                tool_config = (
                    tool_data.get("config")
                    if isinstance(tool_data, dict)
                    else tool_data.config
                )

                assistant_tool = AssistantTool(
                    assistant_version=first_version,
                    tool_id=tool_id,
                    config=tool_config,
                )
                db.add(assistant_tool)

        await db.commit()
        await db.refresh(new_assistant)
        # first_version is already committed and refreshed by create_assistant_version

        # Get assistant with owners and latest version safely
        assistant_with_owners = await assistant_repo.get_with_owners(new_assistant.id)
        latest_version = await assistant_repo.get_latest_version(new_assistant.id)

        # Create explicit response model        # Build AssistantVersionResponse
        assistant_version_response = AssistantVersionResponse(
            id=latest_version.id,
            version=latest_version.version,
            created_at=latest_version.created_at,
            name=latest_version.name,
            description=latest_version.description or "",
            system_prompt=latest_version.system_prompt,
            hierarchical_access=new_assistant.hierarchical_access or [],
            temperature=latest_version.temperature,
            max_output_tokens=latest_version.max_output_tokens,
            examples=latest_version.examples or [],
            quick_prompts=latest_version.quick_prompts or [],
            tags=latest_version.tags or [],
            tools=assistant_repo.get_tools_from_version(latest_version),
            owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
        )

        # Build AssistantResponse
        response = AssistantResponse(
            id=new_assistant.id,
            created_at=new_assistant.created_at,
            updated_at=new_assistant.updated_at,
            hierarchical_access=new_assistant.hierarchical_access or [],
            owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
            latest_version=assistant_version_response,
        )

        return response
    except Exception:
        await db.rollback()
        raise


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
    id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_owner(user_info.lhm_object_id):
        raise NotOwnerException()

    success = await assistant_repo.delete(id)

    if not success:
        raise DeleteFailedException(id)

    await db.commit()
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
    id: str,
    assistant_update: AssistantUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_owner(user_info.lhm_object_id):
        raise NotOwnerException()

    # Get latest version safely
    latest_version = await assistant_repo.get_latest_version(id)
    if not latest_version:
        raise NoVersionException()

    if assistant_update.version != latest_version.version:
        raise VersionConflictException(assistant_update.version, latest_version.version)

    # Handle global properties using the repository update method
    await assistant_repo.update(
        assistant_id=id,
        hierarchical_access=assistant_update.hierarchical_access,
        owner_ids=assistant_update.owner_ids,
    )

    # Create a new version with updated data
    # Using the latest_version already retrieved above
    new_version = await assistant_repo.create_assistant_version(
        assistant,
        name=assistant_update.name
        if assistant_update.name is not None
        else latest_version.name,
        description=assistant_update.description
        if assistant_update.description is not None
        else latest_version.description,
        system_prompt=assistant_update.system_prompt
        if assistant_update.system_prompt is not None
        else latest_version.system_prompt,
        temperature=assistant_update.temperature
        if assistant_update.temperature is not None
        else latest_version.temperature,
        max_output_tokens=assistant_update.max_output_tokens
        if assistant_update.max_output_tokens is not None
        else latest_version.max_output_tokens,
        examples=assistant_update.examples
        if assistant_update.examples is not None
        else latest_version.examples,
        quick_prompts=assistant_update.quick_prompts
        if assistant_update.quick_prompts is not None
        else latest_version.quick_prompts,
        tags=assistant_update.tags
        if assistant_update.tags is not None
        else latest_version.tags,
    )  # Handle tools for the new version
    if assistant_update.tools is not None:
        for tool_data in assistant_update.tools:
            assistant_tool = AssistantTool(
                assistant_version=new_version,
                tool_id=tool_data.id,
                config=tool_data.config,
            )
            db.add(assistant_tool)

    await db.commit()
    await db.refresh(assistant)

    # Get assistant with owners and latest version safely
    assistant_with_owners = await assistant_repo.get_with_owners(assistant.id)
    latest_version = await assistant_repo.get_latest_version(assistant.id)

    # Create explicit response model
    # Build AssistantVersionResponse
    assistant_version_response = AssistantVersionResponse(
        id=latest_version.id,
        version=latest_version.version,
        created_at=latest_version.created_at,
        name=latest_version.name,
        description=latest_version.description or "",
        system_prompt=latest_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        temperature=latest_version.temperature,
        max_output_tokens=latest_version.max_output_tokens,
        examples=latest_version.examples or [],
        quick_prompts=latest_version.quick_prompts or [],
        tags=latest_version.tags or [],
        tools=assistant_repo.get_tools_from_version(latest_version),
        owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
    )

    # Build AssistantResponse
    response = AssistantResponse(
        id=assistant.id,
        created_at=assistant.created_at,
        updated_at=assistant.updated_at,
        hierarchical_access=assistant.hierarchical_access or [],
        owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
        latest_version=assistant_version_response,
    )

    return response


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
    db: AsyncSession = Depends(get_db_session), user_info=Depends(authenticate_user)
):
    assistant_repo = AssistantRepository(db)
    assistants = (
        await assistant_repo.get_all_possible_assistants_for_user_with_department(
            user_info.department
        )
    )

    # Create explicit response models
    response_list = []
    for assistant in assistants:  # Use safe method to get assistant with owners
        assistant_with_owners = await assistant_repo.get_with_owners(assistant.id)
        # Use safe method to access latest version through repository
        latest_version = await assistant_repo.get_latest_version(assistant.id)

        if latest_version:
            # Build AssistantVersionResponse
            assistant_version_response = AssistantVersionResponse(
                id=latest_version.id,
                version=latest_version.version,
                created_at=latest_version.created_at,
                name=latest_version.name,
                description=latest_version.description or "",
                system_prompt=latest_version.system_prompt,
                hierarchical_access=assistant.hierarchical_access or [],
                temperature=latest_version.temperature,
                max_output_tokens=latest_version.max_output_tokens,
                examples=latest_version.examples or [],
                quick_prompts=latest_version.quick_prompts or [],
                tags=latest_version.tags or [],
                tools=assistant_repo.get_tools_from_version(latest_version),
                owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
            )

            # Build AssistantResponse
            response = AssistantResponse(
                id=assistant.id,
                created_at=assistant.created_at,
                updated_at=assistant.updated_at,
                hierarchical_access=assistant.hierarchical_access or [],
                owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
                latest_version=assistant_version_response,
            )
            response_list.append(response)

    return response_list


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
    id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_allowed_for_user(user_info.department):
        raise NotAllowedToAccessException(id)

    # Get assistant with owners safely
    assistant_with_owners = await assistant_repo.get_with_owners(id)
    # Get latest version safely
    latest_version = await assistant_repo.get_latest_version(id)

    # Create explicit response model
    # Build AssistantVersionResponse
    assistant_version_response = AssistantVersionResponse(
        id=latest_version.id,
        version=latest_version.version,
        created_at=latest_version.created_at,
        name=latest_version.name,
        description=latest_version.description or "",
        system_prompt=latest_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        temperature=latest_version.temperature,
        max_output_tokens=latest_version.max_output_tokens,
        examples=latest_version.examples or [],
        quick_prompts=latest_version.quick_prompts or [],
        tags=latest_version.tags or [],
        tools=assistant_repo.get_tools_from_version(latest_version),
        owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
    )

    # Build AssistantResponse
    response = AssistantResponse(
        id=assistant.id,
        created_at=assistant.created_at,
        updated_at=assistant.updated_at,
        hierarchical_access=assistant.hierarchical_access or [],
        owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
        latest_version=assistant_version_response,
    )

    return response


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
    db: AsyncSession = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Get all assistants where the specified lhmobjektID is an owner."""
    # Get all assistants where this lhmobjektID is an owner
    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_assistants_by_owner(
        user_info.lhm_object_id
    )  # Create explicit response models
    response_list = []
    for assistant in assistants:
        # Get assistant with owners safely
        assistant_with_owners = await assistant_repo.get_with_owners(assistant.id)
        # Get latest version safely
        latest_version = await assistant_repo.get_latest_version(assistant.id)

        if latest_version:
            # Build AssistantVersionResponse
            assistant_version_response = AssistantVersionResponse(
                id=latest_version.id,
                version=latest_version.version,
                created_at=latest_version.created_at,
                name=latest_version.name,
                description=latest_version.description or "",
                system_prompt=latest_version.system_prompt,
                hierarchical_access=assistant.hierarchical_access or [],
                temperature=latest_version.temperature,
                max_output_tokens=latest_version.max_output_tokens,
                examples=latest_version.examples or [],
                quick_prompts=latest_version.quick_prompts or [],
                tags=latest_version.tags or [],
                tools=assistant_repo.get_tools_from_version(latest_version),
                owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
            )

            # Build AssistantResponse
            response = AssistantResponse(
                id=assistant.id,
                created_at=assistant.created_at,
                updated_at=assistant.updated_at,
                hierarchical_access=assistant.hierarchical_access or [],
                owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
                latest_version=assistant_version_response,
            )
            response_list.append(response)

    return response_list


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
    id: str,
    version: int,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not assistant.is_allowed_for_user(user_info.department):
        raise NotAllowedToAccessException(id)

    assistant_version = await assistant_repo.get_assistant_version(id, version)

    if not assistant_version:
        raise VersionNotFoundException(id, version)

    # Get assistant with owners safely for the owner_ids field
    assistant_with_owners = await assistant_repo.get_with_owners(id)

    # Create explicit response model
    response = AssistantVersionResponse(
        id=assistant_version.id,
        version=assistant_version.version,
        created_at=assistant_version.created_at,
        name=assistant_version.name,
        description=assistant_version.description or "",
        system_prompt=assistant_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        temperature=assistant_version.temperature,
        max_output_tokens=assistant_version.max_output_tokens,
        examples=assistant_version.examples or [],
        quick_prompts=assistant_version.quick_prompts or [],
        tags=assistant_version.tags or [],
        tools=assistant_repo.get_tools_from_version(assistant_version),
        owner_ids=[owner.lhmobjektID for owner in assistant_with_owners.owners],
    )

    return response


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
