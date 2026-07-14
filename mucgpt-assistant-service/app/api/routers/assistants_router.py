from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AssistantCreate,
    AssistantListSortBy,
    AssistantListSortOrder,
    AssistantResponse,
    AssistantUpdate,
    AssistantVersionResponse,
)
from api.exceptions import (
    AssistantNotFoundException,
    DeleteFailedException,
    NotAllowedToAccessException,
    NotOwnerException,
    NoVersionException,
    VersionConflictException,
    VersionNotFoundException,
)
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.owner_enrichment import (
    build_owner_details,
    get_missing_owner_cache_ids,
    refresh_owner_details,
)
from database.assistant_repo import AssistantRepository
from database.database_models import AssistantTool
from database.session import get_db_session

logger = getLogger("assistants_router")

router = APIRouter()


@router.post(
    "/assistant/create",
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
async def createAssistant(
    assistant: AssistantCreate,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):  # Create a new assistant using the repository
    logger.info(f"Creating assistant for user {user_info.user_id}")
    try:
        owner_lookup_cache: dict[str, dict[str, object]] = {}
        assistant_repo = AssistantRepository(
            db
        )  # Prepare owner_ids: include the creating user if not already present
        owner_ids = list(assistant.owner_ids) if assistant.owner_ids else []
        if user_info.user_id not in owner_ids:
            owner_ids.append(user_info.user_id)

        is_visible: bool = (
            assistant.is_visible if assistant.is_visible is not None else True
        )

        new_assistant = await assistant_repo.create(
            hierarchical_access=assistant.hierarchical_access or [],
            owner_ids=owner_ids,
            is_visible=is_visible,
        )
        assistant_id: str = str(new_assistant.id)
        # Create the first version with the actual assistant data
        first_version = await assistant_repo.create_assistant_version(
            new_assistant,
            name=assistant.name,
            description=assistant.description or "",
            system_prompt=assistant.system_prompt,
            creativity=assistant.creativity,
            default_model=assistant.default_model,
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

        # Get assistant with owners safely
        assistant_with_owners = await assistant_repo.get_with_owners(assistant_id)
        owner_ids = [owner.user_id for owner in assistant_with_owners.owners]
        await refresh_owner_details(owner_ids, db)
        await db.commit()

        # Commit expires ORM instances; re-fetch before reading attributes.
        assistant_record = await assistant_repo.get(assistant_id)
        assistant_with_owners = await assistant_repo.get_with_owners(assistant_id)
        latest_version = await assistant_repo.get_latest_version(assistant_id)

        if assistant_record is None:
            raise AssistantNotFoundException(assistant_id)
        if latest_version is None:
            raise NoVersionException(assistant_id)

        owners_detailed = await build_owner_details(
            owner_ids,
            owner_lookup_cache,
            owners=assistant_with_owners.owners,
        )

        # Create explicit response model        # Build AssistantVersionResponse
        assistant_version_response = AssistantVersionResponse(
            id=assistant_id,
            version=latest_version.version,
            created_at=latest_version.created_at,
            name=latest_version.name,
            description=latest_version.description or "",
            system_prompt=latest_version.system_prompt,
            hierarchical_access=assistant_record.hierarchical_access or [],
            creativity=latest_version.creativity,
            default_model=latest_version.default_model,
            examples=latest_version.examples or [],
            quick_prompts=latest_version.quick_prompts or [],
            tags=latest_version.tags or [],
            tools=assistant_repo.get_tools_from_version(latest_version),
            owner_ids=owner_ids,
            owners_detailed=owners_detailed,
            is_visible=is_visible,
        )  # Build AssistantResponse
        response = AssistantResponse(
            id=assistant_id,
            created_at=assistant_record.created_at,
            updated_at=assistant_record.updated_at,
            hierarchical_access=assistant_record.hierarchical_access or [],
            is_visible=is_visible,
            owner_ids=owner_ids,
            owners_detailed=owners_detailed,
            subscriptions_count=getattr(assistant_record, "subscriptions_count", 0)
            or 0,
            latest_version=assistant_version_response,
        )

        logger.info(f"Assistant created with ID: {new_assistant.id}")
        return response
    except Exception as e:
        logger.error(f"Error creating assistant: {e}")
        await db.rollback()
        raise


@router.post(
    "/assistant/{id}/delete",
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
async def deleteAssistant(
    id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    logger.info(f"Deleting assistant with ID: {id} by user {user_info.user_id}")
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not await assistant_repo.is_owner(id, user_info.user_id):
        raise NotOwnerException()

    success = await assistant_repo.delete(id)

    if not success:
        raise DeleteFailedException(id)

    await db.commit()
    logger.info(f"Assistant with ID {id} successfully deleted")
    return {"message": f"Assistant with ID {id} successfully deleted"}


@router.post(
    "/assistant/{id}/update",
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
async def updateAssistant(
    id: str,
    assistant_update: AssistantUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> AssistantResponse:
    logger.info(f"Updating assistant with ID: {id} by user {user_info.user_id}")
    owner_lookup_cache: dict[str, dict[str, object]] = {}
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not await assistant_repo.is_owner(id, user_info.user_id):
        raise NotOwnerException()

    is_visible: bool = (
        assistant_update.is_visible if assistant_update.is_visible is not None else True
    )
    # Get latest version safely
    latest_version = await assistant_repo.get_latest_version(id)
    if not latest_version:
        raise NoVersionException()

    if assistant_update.version != latest_version.version:
        raise VersionConflictException(
            assistant_update.version, latest_version.version
        )  # Handle global properties using the repository update method
    await assistant_repo.update(
        assistant_id=id,
        hierarchical_access=assistant_update.hierarchical_access,
        owner_ids=assistant_update.owner_ids,
        is_visible=is_visible,
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
        creativity=assistant_update.creativity
        if assistant_update.creativity is not None
        else latest_version.creativity,
        default_model=(
            None
            if assistant_update.default_model == ""
            else (
                assistant_update.default_model
                if assistant_update.default_model is not None
                else latest_version.default_model
            )
        ),
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
    owner_ids = [owner.user_id for owner in assistant_with_owners.owners]
    await refresh_owner_details(owner_ids, db)
    await db.commit()
    assistant_with_owners = await assistant_repo.get_with_owners(assistant.id)
    owners_detailed = await build_owner_details(
        owner_ids,
        owner_lookup_cache,
        owners=assistant_with_owners.owners,
    )

    # Create explicit response model
    # Build AssistantVersionResponse
    assistant_version_response = AssistantVersionResponse(
        id=id,
        version=latest_version.version,
        created_at=latest_version.created_at,
        name=latest_version.name,
        description=latest_version.description or "",
        system_prompt=latest_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        creativity=latest_version.creativity,
        default_model=latest_version.default_model,
        examples=latest_version.examples or [],
        quick_prompts=latest_version.quick_prompts or [],
        tags=latest_version.tags or [],
        tools=assistant_repo.get_tools_from_version(latest_version),
        owner_ids=owner_ids,
        owners_detailed=owners_detailed,
        is_visible=is_visible,
    )

    # Build AssistantResponse
    response = AssistantResponse(
        id=id,
        created_at=assistant.created_at,
        updated_at=assistant.updated_at,
        hierarchical_access=assistant.hierarchical_access or [],
        is_visible=is_visible,
        owner_ids=owner_ids,
        owners_detailed=owners_detailed,
        subscriptions_count=getattr(assistant, "subscriptions_count", 0) or 0,
        latest_version=assistant_version_response,
    )

    logger.info(f"Assistant with ID {id} updated successfully")
    return response


@router.get(
    "/assistant",
    response_model=list[AssistantResponse],
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
async def getAllAssistants(
    search: str | None = Query(
        None,
        description="Search term matched against latest version title, description, and tags.",
    ),
    sort_by: AssistantListSortBy = Query(
        "subscriptions",
        description="Sort assistants by title, updated timestamp, or subscriptions.",
    ),
    sort_order: AssistantListSortOrder = Query(
        "desc", description="Sort order, ascending or descending."
    ),
    offset: int = Query(0, ge=0, description="Number of items to skip."),
    limit: int = Query(
        200,
        ge=1,
        le=500,
        description="Maximum number of items to return.",
    ),
    exclude_owned: bool = Query(
        False,
        description="Exclude assistants owned by the authenticated user.",
    ),
    exclude_subscribed: bool = Query(
        False,
        description="Exclude assistants subscribed by the authenticated user.",
    ),
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    logger.info(f"Fetching all accessible assistants for user {user_info.user_id}")
    owner_lookup_cache: dict[str, dict[str, object]] = {}
    assistant_repo = AssistantRepository(db)
    assistants = (
        await assistant_repo.get_all_possible_assistants_for_user_with_department(
            user_info.department,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            offset=offset,
            limit=limit,
            exclude_owned_by_user_id=user_info.user_id if exclude_owned else None,
            exclude_subscribed_by_user_id=user_info.user_id
            if exclude_subscribed
            else None,
        )
    )

    # Create explicit response models
    response_list = []
    for assistant in assistants:
        latest_version = assistant.versions[0] if assistant.versions else None
        if latest_version:
            is_visible = (
                assistant.is_visible if assistant.is_visible is not None else True
            )
            assistant_id = str(assistant.id)
            owner_ids = [owner.user_id for owner in assistant.owners]
            owners_detailed = await build_owner_details(
                owner_ids,
                owner_lookup_cache,
                owners=assistant.owners,
            )
            # Build AssistantVersionResponse
            assistant_version_response = AssistantVersionResponse(
                id=assistant_id,
                version=latest_version.version,
                created_at=latest_version.created_at,
                name=latest_version.name,
                description=latest_version.description or "",
                system_prompt=latest_version.system_prompt,
                hierarchical_access=assistant.hierarchical_access or [],
                creativity=latest_version.creativity,
                default_model=latest_version.default_model,
                examples=latest_version.examples or [],
                quick_prompts=latest_version.quick_prompts or [],
                tags=latest_version.tags or [],
                tools=assistant_repo.get_tools_from_version(latest_version),
                owner_ids=owner_ids,
                owners_detailed=owners_detailed,
                is_visible=is_visible,
            )

            # Build AssistantResponse
            response = AssistantResponse(
                id=assistant_id,
                created_at=assistant.created_at,
                updated_at=assistant.updated_at,
                hierarchical_access=assistant.hierarchical_access or [],
                is_visible=is_visible,
                owner_ids=owner_ids,
                owners_detailed=owners_detailed,
                subscriptions_count=getattr(assistant, "subscriptions_count", 0) or 0,
                latest_version=assistant_version_response,
            )
            response_list.append(response)

    logger.info(
        f"Returning {len(response_list)} accessible assistants for user {user_info.user_id}"
    )
    return response_list


@router.get(
    "/assistant/{id}",
    response_model=AssistantResponse,
    summary="Get a specific assistant",
    description="""
    Retrieve detailed information about a specific AI assistant by its ID.

    """,
    tags=["Assistants"],
    responses={
        200: {"description": "Detailed information about the requested assistant"},
        401: {"description": "Unauthorized"},
        403: {"description": "User is not allowed to access the assistant"},
        404: {"description": "Assistant not found"},
    },
)
async def getAssistant(
    id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    logger.info(f"Fetching assistant with ID: {id} for user {user_info.user_id}")
    owner_lookup_cache: dict[str, dict[str, object]] = {}
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(
            id
        )  # Check if the user is allowed to access this assistant
    if not await assistant.is_allowed_for_user(
        user_info.department
    ) and not await assistant_repo.is_owner(id, user_info.user_id):
        raise NotAllowedToAccessException(id)

    # Get assistant with owners safely
    assistant_with_owners = await assistant_repo.get_with_owners(id)
    # Get latest version safely
    latest_version = await assistant_repo.get_latest_version(id)
    owner_ids = [owner.user_id for owner in assistant_with_owners.owners]

    settings = get_settings()
    if settings.OWNER_CACHE_REFRESH_ON_READ:
        missing_owner_ids = get_missing_owner_cache_ids(
            owner_ids,
            assistant_with_owners.owners,
        )
        if missing_owner_ids:
            await refresh_owner_details(missing_owner_ids, db)
            await db.commit()
            # Session commit expires ORM state; reload entities used below.
            assistant = await assistant_repo.get(id)
            latest_version = await assistant_repo.get_latest_version(id)
            assistant_with_owners = await assistant_repo.get_with_owners(id)

    owners_detailed = await build_owner_details(
        owner_ids,
        owner_lookup_cache,
        owners=assistant_with_owners.owners,
    )

    is_visible: bool = (
        bool(assistant.is_visible) if assistant.is_visible is not None else True
    )

    # Create explicit response model
    # Build AssistantVersionResponse
    assistant_version_response = AssistantVersionResponse(
        id=id,
        version=latest_version.version,
        created_at=latest_version.created_at,
        name=latest_version.name,
        description=latest_version.description or "",
        system_prompt=latest_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        creativity=latest_version.creativity,
        default_model=latest_version.default_model,
        examples=latest_version.examples or [],
        quick_prompts=latest_version.quick_prompts or [],
        tags=latest_version.tags or [],
        tools=assistant_repo.get_tools_from_version(latest_version),
        owner_ids=owner_ids,
        owners_detailed=owners_detailed,
        is_visible=is_visible,
    )  # Build AssistantResponse
    response = AssistantResponse(
        id=id,
        created_at=assistant.created_at,
        updated_at=assistant.updated_at,
        hierarchical_access=assistant.hierarchical_access or [],
        is_visible=is_visible,
        owner_ids=owner_ids,
        owners_detailed=owners_detailed,
        subscriptions_count=getattr(assistant, "subscriptions_count", 0) or 0,
        latest_version=assistant_version_response,
    )

    logger.info(f"Returning assistant with ID: {id}")
    return response


@router.get(
    "/assistant/{id}/version/{version}",
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
    logger.info(
        f"Fetching version {version} of assistant {id} for user {user_info.user_id}"
    )
    owner_lookup_cache: dict[str, dict[str, object]] = {}
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(id)

    if not assistant:
        raise AssistantNotFoundException(id)

    if not await assistant.is_allowed_for_user(
        user_info.department
    ) and not await assistant_repo.is_owner(id, user_info.user_id):
        raise NotAllowedToAccessException(id)

    assistant_version = await assistant_repo.get_assistant_version(id, version)

    if not assistant_version:
        raise VersionNotFoundException(id, version)

    # Get assistant with owners safely for the owner_ids field
    assistant_with_owners = await assistant_repo.get_with_owners(id)
    owner_ids = [owner.user_id for owner in assistant_with_owners.owners]

    settings = get_settings()
    if settings.OWNER_CACHE_REFRESH_ON_READ:
        missing_owner_ids = get_missing_owner_cache_ids(
            owner_ids,
            assistant_with_owners.owners,
        )
        if missing_owner_ids:
            await refresh_owner_details(missing_owner_ids, db)
            await db.commit()
            # Session commit expires ORM state; reload entities used below.
            assistant = await assistant_repo.get(id)
            assistant_version = await assistant_repo.get_assistant_version(id, version)
            assistant_with_owners = await assistant_repo.get_with_owners(id)

    owners_detailed = await build_owner_details(
        owner_ids,
        owner_lookup_cache,
        owners=assistant_with_owners.owners,
    )

    # Create explicit response model
    response = AssistantVersionResponse(
        id=id,
        version=assistant_version.version,
        created_at=assistant_version.created_at,
        name=assistant_version.name,
        description=assistant_version.description or "",
        system_prompt=assistant_version.system_prompt,
        hierarchical_access=assistant.hierarchical_access or [],
        creativity=assistant_version.creativity,
        default_model=assistant_version.default_model,
        examples=assistant_version.examples or [],
        quick_prompts=assistant_version.quick_prompts or [],
        tags=assistant_version.tags or [],
        tools=assistant_repo.get_tools_from_version(assistant_version),
        owner_ids=owner_ids,
        owners_detailed=owners_detailed,
        is_visible=assistant.is_visible,
    )

    logger.info(f"Returning version {version} of assistant {id}")
    return response
