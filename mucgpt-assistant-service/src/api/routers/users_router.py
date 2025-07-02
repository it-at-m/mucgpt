from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import AssistantResponse, AssistantVersionResponse
from core.auth import authenticate_user
from core.logtools import getLogger
from database.assistant_repo import AssistantRepository
from database.session import get_db_session

logger = getLogger("users_router")

router = APIRouter()


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
            logger.debug(f"Assistant found: {assistant.id}")

    logger.info(
        f"Returning {len(response_list)} assistants for user {user_info.lhm_object_id}"
    )
    return response_list
