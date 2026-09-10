from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AssistantListSortBy,
    AssistantListSortOrder,
    AssistantResponse,
    AssistantState,
    AssistantStateUpdate,
)
from api.exceptions import AssistantNotFoundException, VersionConflictException
from api.routers.users_router import _build_assistant_response_list
from core.auth import require_admin
from core.auth_models import AuthenticationResult
from database.assistant_repo import AssistantRepository
from database.database_models import AssistantTool
from database.session import get_db_session

router = APIRouter()


@router.get(
    "/admin/assistant/review",
    response_model=list[AssistantResponse],
    summary="List assistants awaiting legal review",
    tags=["Admin"],
)
async def get_review_queue(
    state: AssistantState = Query("pending_legal_review"),
    search: str | None = Query(None),
    sort_by: AssistantListSortBy = Query("updated"),
    sort_order: AssistantListSortOrder = Query("asc"),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> list[AssistantResponse]:
    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_assistants_by_latest_state(
        state=state,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=offset,
        limit=limit,
    )
    return await _build_assistant_response_list(assistants, assistant_repo)


@router.patch(
    "/admin/assistant/{assistant_id}/state",
    response_model=AssistantResponse,
    summary="Record an administrator lifecycle decision",
    tags=["Admin"],
)
async def update_assistant_state(
    assistant_id: str,
    state_update: AssistantStateUpdate,
    db: AsyncSession = Depends(get_db_session),
    admin: AuthenticationResult = Depends(require_admin),
) -> AssistantResponse:
    """Append a reviewed immutable version without mutating the reviewed version."""
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get(assistant_id)
    if assistant is None:
        raise AssistantNotFoundException(assistant_id)

    latest_version = await assistant_repo.get_latest_version(assistant_id)
    if latest_version is None or latest_version.version != state_update.version:
        raise VersionConflictException(
            state_update.version,
            latest_version.version if latest_version is not None else "none",
        )
    if latest_version.state != state_update.expected_state:
        raise VersionConflictException(state_update.version, latest_version.version)

    review_version = await assistant_repo.create_assistant_version(
        assistant=assistant,
        name=latest_version.name,
        description=latest_version.description or "",
        system_prompt=latest_version.system_prompt,
        creativity=latest_version.creativity,
        default_model=latest_version.default_model,
        examples=latest_version.examples or [],
        quick_prompts=latest_version.quick_prompts or [],
        tags=latest_version.tags or [],
        compliance_check_result=latest_version.compliance_check_result,
        compliance_confirmation=latest_version.compliance_confirmation,
        state=state_update.state,
        state_changed_by=admin.user_id,
        state_change_reason=state_update.reason,
    )
    for tool in latest_version.tool_associations:
        db.add(
            AssistantTool(
                assistant_version=review_version,
                tool_id=tool.tool_id,
                config=tool.config,
            )
        )
    await db.commit()

    refreshed_assistant = await assistant_repo.get_with_owners(assistant_id)
    return (
        await _build_assistant_response_list([refreshed_assistant], assistant_repo)
    )[0]
