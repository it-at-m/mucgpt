from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AssistantResponse,
    AssistantVersionResponse,
    StatusResponse,
    SubscriptionResponse,
)
from api.exceptions import (
    AlreadySubscribedException,
    AssistantNotFoundException,
    NotAllowedToAccessException,
    SubscriptionNotFoundException,
)
from core.auth import authenticate_user
from core.logtools import getLogger
from database.assistant_repo import AssistantRepository
from database.database_models import Assistant
from database.session import get_db_session

logger = getLogger("users_router")

router = APIRouter()


async def _build_assistant_response_list(
    assistants: List[Assistant], assistant_repo: AssistantRepository
) -> List[AssistantResponse]:
    """
    Helper function to build a list of AssistantResponse objects from a list of Assistants.
    This centralizes the logic and avoids code duplication.
    """
    # In a production environment, the repository methods should be optimized
    # to fetch all necessary data (latest versions, owners) in a more efficient way
    # (e.g., using SQLAlchemy joined loads) to avoid the N+1 query problem.
    response_list = []
    for assistant in assistants:
        # These calls are inefficient in a loop (N+1 problem).
        # Consider refactoring the repository to fetch this data more efficiently.
        assistant_with_owners = await assistant_repo.get_with_owners(assistant.id)
        latest_version = await assistant_repo.get_latest_version(assistant.id)

        if latest_version and assistant_with_owners:
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


@router.get(
    "/user/bots",
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
    logger.info(f"Fetching assistants for user {user_info.lhm_object_id}")
    # Get all assistants where this lhmobjektID is an owner
    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_assistants_by_owner(
        user_info.lhm_object_id
    )  # Create explicit response models
    response_list = await _build_assistant_response_list(assistants, assistant_repo)

    logger.info(
        f"Returning {len(response_list)} assistants for user {user_info.lhm_object_id}"
    )
    return response_list


@router.post(
    "/user/subscriptions/{assistant_id}",
    response_model=StatusResponse,
    summary="Subscribe to an assistant",
    description="""
    Subscribe to an AI assistant. Users can only subscribe to assistants they have access to
    based on ownership or hierarchical access permissions.
    """,
    responses={
        200: {"description": "Successfully subscribed to assistant"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - No access to this assistant"},
        404: {"description": "Assistant not found"},
        409: {"description": "Already subscribed to this assistant"},
    },
    tags=["Subscriptions", "Users"],
)
async def subscribe_to_assistant(
    assistant_id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Subscribe to an assistant if user has access permissions."""
    logger.info(
        f"User {user_info.lhm_object_id} attempting to subscribe to assistant {assistant_id}"
    )

    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(assistant_id)
    if not assistant:
        raise AssistantNotFoundException(assistant_id)
    if not assistant.is_allowed_for_user(user_info.department):
        raise NotAllowedToAccessException(assistant_id)

    is_subscribed = await assistant_repo.is_user_subscribed(
        assistant_id, user_info.lhm_object_id
    )
    if is_subscribed:
        raise AlreadySubscribedException(assistant_id)

    await assistant_repo.create_subscription(assistant_id, user_info.lhm_object_id)

    logger.info(
        f"User {user_info.lhm_object_id} successfully subscribed to assistant {assistant_id}"
    )
    return StatusResponse(message="Successfully subscribed to assistant")


@router.delete(
    "/user/subscriptions/{assistant_id}",
    response_model=StatusResponse,
    summary="Unsubscribe from an assistant",
    description="Remove subscription to an AI assistant.",
    responses={
        200: {"description": "Successfully unsubscribed from assistant"},
        401: {"description": "Unauthorized"},
        404: {"description": "Subscription not found"},
    },
    tags=["Subscriptions", "Users"],
)
async def unsubscribe_from_assistant(
    assistant_id: str,
    db: AsyncSession = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Unsubscribe from an assistant."""
    logger.info(
        f"User {user_info.lhm_object_id} attempting to unsubscribe from assistant {assistant_id}"
    )

    assistant_repo = AssistantRepository(db)
    is_subscribed = await assistant_repo.is_user_subscribed(
        assistant_id, user_info.lhm_object_id
    )
    if not is_subscribed:
        raise SubscriptionNotFoundException(assistant_id)

    await assistant_repo.remove_subscription(assistant_id, user_info.lhm_object_id)

    logger.info(
        f"User {user_info.lhm_object_id} successfully unsubscribed from assistant {assistant_id}"
    )
    return StatusResponse(message="Successfully unsubscribed from assistant")


@router.get(
    "/user/subscriptions",
    response_model=List[SubscriptionResponse],
    summary="Get user's subscribed assistants",
    description="Retrieve all assistants the user has subscribed to with simplified information (ID and name only).",
    responses={
        200: {"description": "List of subscribed assistants with ID and name"},
        401: {"description": "Unauthorized"},
    },
    tags=["Subscriptions", "Users"],
)
async def get_user_subscriptions(
    db: AsyncSession = Depends(get_db_session),
    user_info=Depends(authenticate_user),
):
    """Get all assistants the user has subscribed to."""
    logger.info(f"Fetching subscriptions for user {user_info.lhm_object_id}")

    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_user_subscriptions(user_info.lhm_object_id)

    # Build simplified response with only ID and name
    response_list = []
    for assistant in assistants:
        latest_version = await assistant_repo.get_latest_version(assistant.id)
        if latest_version:
            response = SubscriptionResponse(id=assistant.id, name=latest_version.name, description=latest_version.description)
            response_list.append(response)

    logger.info(
        f"Returning {len(response_list)} subscribed assistants for user {user_info.lhm_object_id}"
    )
    return response_list
