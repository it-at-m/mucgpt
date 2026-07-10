from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AssistantResponse,
    AssistantVersionResponse,
    StatusResponse,
    SubscriptionResponse,
    UserLookupResponse,
)
from api.exceptions import (
    AlreadySubscribedException,
    AssistantNotFoundException,
    NotAllowedToAccessException,
    SubscriptionNotFoundException,
)
from config.settings import get_ldap_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.organization import LDAPPersonLookupError, LDAPPersonLookupLoader
from core.owner_enrichment import build_owner_details
from database.assistant_repo import AssistantRepository
from database.database_models import Assistant
from database.session import get_db_session

logger = getLogger("users_router")

router = APIRouter()


async def _build_assistant_response_list(
    assistants: list[Assistant], assistant_repo: AssistantRepository
) -> list[AssistantResponse]:
    """
    Helper function to build a list of AssistantResponse objects from a list of Assistants.
    This centralizes the logic and avoids code duplication.
    """
    # In a production environment, the repository methods should be optimized
    # to fetch all necessary data (latest versions, owners) in a more efficient way
    # (e.g., using SQLAlchemy joined loads) to avoid the N+1 query problem.
    response_list: list[AssistantResponse] = []
    owner_lookup_cache: dict[str, dict[str, object]] = {}
    for assistant in assistants:
        # These calls are inefficient in a loop (N+1 problem).
        # Consider refactoring the repository to fetch this data more efficiently.
        assistant_id = str(assistant.id)
        assistant_with_owners = await assistant_repo.get_with_owners(assistant_id)
        latest_version = await assistant_repo.get_latest_version(assistant_id)
        is_visible = (
            bool(assistant.is_visible) if assistant.is_visible is not None else True
        )
        if latest_version and assistant_with_owners:
            owner_ids = [owner.user_id for owner in assistant_with_owners.owners]
            owners_detailed = await build_owner_details(
                owner_ids,
                owner_lookup_cache,
                owners=assistant_with_owners.owners,
            )
            assistant_version_response = AssistantVersionResponse(
                id=assistant_id,
                version=getattr(latest_version, "version", 0),
                created_at=getattr(latest_version, "created_at"),
                name=getattr(latest_version, "name", ""),
                description=getattr(latest_version, "description", ""),
                system_prompt=getattr(latest_version, "system_prompt", ""),
                hierarchical_access=assistant.hierarchical_access
                if isinstance(assistant.hierarchical_access, list)
                else [],
                creativity=getattr(latest_version, "creativity", "medium"),
                default_model=getattr(latest_version, "default_model", None),
                examples=latest_version.examples or [],
                quick_prompts=latest_version.quick_prompts or [],
                tags=latest_version.tags or [],
                tools=assistant_repo.get_tools_from_version(latest_version),
                owner_ids=owner_ids,
                owners_detailed=owners_detailed,
                is_visible=is_visible,
            )
            response = AssistantResponse(
                id=assistant_id,
                created_at=getattr(assistant, "created_at"),
                updated_at=getattr(assistant, "updated_at"),
                hierarchical_access=assistant.hierarchical_access or [],
                is_visible=is_visible,
                owner_ids=owner_ids,
                owners_detailed=owners_detailed,
                subscriptions_count=getattr(assistant, "subscriptions_count", 0) or 0,
                latest_version=assistant_version_response,
            )
            response_list.append(response)
    return response_list


@router.get(
    "/user/assistants",
    response_model=list[AssistantResponse],
    summary="Get assistants owned by a specific user",
    description="""
    Retrieve all AI assistants where the specified user_id is listed as an owner.

    """,
    responses={
        200: {"description": "List of assistants owned by the specified user"},
        401: {"description": "Unauthorized"},
    },
    tags=["Assistants", "Users"],
)
async def getUserAssistants(
    db: AsyncSession = Depends(get_db_session),
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    """Get all assistants where the specified user_id is an owner."""
    logger.info(f"Fetching assistants for user {user_info.user_id}")
    # Get all assistants where this user_id is an owner
    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_assistants_by_owner(
        user_info.user_id
    )  # Create explicit response models
    response_list = await _build_assistant_response_list(assistants, assistant_repo)

    logger.info(
        f"Returning {len(response_list)} assistants for user {user_info.user_id}"
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
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    """Subscribe to an assistant if user has access permissions."""
    logger.info(
        f"User {user_info.user_id} attempting to subscribe to assistant {assistant_id}"
    )

    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(assistant_id)
    if not assistant:
        raise AssistantNotFoundException(assistant_id)
    if not await assistant.is_allowed_for_user(user_info.department):
        raise NotAllowedToAccessException(assistant_id)

    is_subscribed = await assistant_repo.is_user_subscribed(
        assistant_id, user_info.user_id
    )
    if is_subscribed:
        raise AlreadySubscribedException(assistant_id)

    await assistant_repo.create_subscription(assistant_id, user_info.user_id)
    await db.commit()

    logger.info(
        f"User {user_info.user_id} successfully subscribed to assistant {assistant_id} "
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
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    """Unsubscribe from an assistant."""
    logger.info(
        f"User {user_info.user_id} attempting to unsubscribe from assistant {assistant_id}"
    )

    assistant_repo = AssistantRepository(db)
    is_subscribed = await assistant_repo.is_user_subscribed(
        assistant_id, user_info.user_id
    )
    if not is_subscribed:
        raise SubscriptionNotFoundException(assistant_id)

    await assistant_repo.remove_subscription(assistant_id, user_info.user_id)
    await db.commit()

    logger.info(
        f"User {user_info.user_id} successfully unsubscribed from assistant {assistant_id}"
    )
    return StatusResponse(message="Successfully unsubscribed from assistant")


@router.get(
    "/user/subscriptions",
    response_model=list[SubscriptionResponse],
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
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    """Get all assistants the user has subscribed to."""
    logger.info(f"Fetching subscriptions for user {user_info.user_id}")

    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_user_subscriptions(user_info.user_id)

    # Build simplified response with only ID and name
    response_list = []
    for assistant in assistants:
        assistant_id = str(assistant.id)
        latest_version = await assistant_repo.get_latest_version(assistant_id)
        if latest_version:
            response = SubscriptionResponse(
                id=assistant_id,
                title=getattr(latest_version, "name", ""),
                description=getattr(latest_version, "description", ""),
            )
            response_list.append(response)

    logger.info(
        f"Returning {len(response_list)} subscribed assistants for user {user_info.user_id}"
    )
    return response_list


@router.get(
    "/user/lookup/{lhmobjectid}",
    response_model=UserLookupResponse,
    summary="Lookup user in LDAP by lhmobjectid",
    description="Retrieve contact details and names for a user from LDAP based on lhmobjectid.",
    responses={
        200: {"description": "User found"},
        401: {"description": "Unauthorized"},
        404: {"description": "User not found"},
        502: {"description": "Malformed LDAP response"},
        503: {"description": "LDAP lookup unavailable"},
    },
    tags=["Users", "Directory"],
)
async def lookup_user_by_lhmobjectid(
    lhmobjectid: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
):
    logger.info(
        "User %s requested LDAP lookup for lhmobjectid=%s",
        user_info.user_id,
        lhmobjectid,
    )

    loader = LDAPPersonLookupLoader(get_ldap_settings())
    try:
        payload = await asyncio.to_thread(loader.lookup_by_lhmobjectid, lhmobjectid)
    except LDAPPersonLookupError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if payload is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not payload.get("lhmobjectid"):
        raise HTTPException(
            status_code=502,
            detail="LDAP response did not include required lhmobjectid attribute",
        )

    return UserLookupResponse(**payload)
