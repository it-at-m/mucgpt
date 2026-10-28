from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AdminOwnersUpdate,
    AdminTagsUpdate,
    AssistantAccessType,
    AssistantAuditEventResponse,
    AssistantListSortBy,
    AssistantListSortOrder,
    AssistantResponse,
    AssistantState,
    AssistantStateUpdate,
    AssistantToolGrantResponse,
    AssistantToolGrantUpdate,
    ComplianceStatus,
)
from api.exceptions import AssistantNotFoundException, VersionConflictException
from api.routers.users_router import _build_assistant_response_list
from core.auth import require_admin
from core.auth_models import AuthenticationResult
from core.owner_enrichment import refresh_owner_details
from database.assistant_repo import AssistantRepository
from database.database_models import AssistantTool
from database.session import get_db_session

router = APIRouter()


@router.get(
    "/admin/assistants",
    response_model=list[AssistantResponse],
    summary="List all assistants for administration",
    tags=["Admin"],
)
async def get_all_assistants(
    state: AssistantState | None = Query(None),
    compliance_status: ComplianceStatus | None = Query(None),
    access: AssistantAccessType | None = Query(None),
    department: str | None = Query(None),
    tool_grant: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: AssistantListSortBy = Query("updated"),
    sort_order: AssistantListSortOrder = Query("desc"),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> list[AssistantResponse]:
    """List every assistant without user visibility or hierarchy restrictions."""
    assistant_repo = AssistantRepository(db)
    assistants = await assistant_repo.get_all_assistants_for_admin(
        state=state,
        compliance_status=compliance_status,
        access=access,
        department=department,
        tool_grant=tool_grant,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=offset,
        limit=limit,
    )
    return await _build_assistant_response_list(assistants, assistant_repo)


@router.get(
    "/admin/assistant/review",
    response_model=list[AssistantResponse],
    summary="List assistants awaiting legal review",
    tags=["Admin"],
)
async def get_review_queue(
    state: AssistantState = Query(AssistantState.PENDING_LEGAL_REVIEW),
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
    "/admin/assistant/{assistant_id}/tags",
    response_model=AssistantResponse,
    summary="Update administrator-managed assistant tags",
    tags=["Admin"],
)
async def update_admin_tags(
    assistant_id: str,
    tags_update: AdminTagsUpdate,
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> AssistantResponse:
    """Update parent-level metadata without creating an assistant version."""
    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get_for_update(assistant_id)
    if assistant is None:
        raise AssistantNotFoundException(assistant_id)

    previous_tags = list(assistant.admin_tags or [])
    next_tags = list(dict.fromkeys(tags_update.admin_tags))
    await assistant_repo.update_admin_tags(assistant, next_tags)
    await assistant_repo.record_audit_event(
        assistant_id=assistant_id,
        actor_user_id=_admin.user_id,
        actor_name=_admin.name,
        action="admin_tags_updated",
        before={"admin_tags": previous_tags},
        after={"admin_tags": next_tags},
    )
    await db.commit()
    refreshed_assistant = await assistant_repo.get_with_owners(assistant_id)
    return (
        await _build_assistant_response_list([refreshed_assistant], assistant_repo)
    )[0]


@router.patch(
    "/admin/assistant/{assistant_id}/owners",
    response_model=AssistantResponse,
    summary="Update assistant owners",
    tags=["Admin"],
)
async def update_admin_owners(
    assistant_id: str,
    owners_update: AdminOwnersUpdate,
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> AssistantResponse:
    """Replace an assistant's owners without creating a new assistant version."""
    owner_ids = list(
        dict.fromkeys(owner_id.strip() for owner_id in owners_update.owner_ids)
    )
    if not all(owner_ids):
        raise HTTPException(status_code=422, detail="Owner IDs must not be empty")

    assistant_repo = AssistantRepository(db)
    assistant = await assistant_repo.get_for_update(assistant_id)
    if assistant is None:
        raise AssistantNotFoundException(assistant_id)

    previous_owner_ids = await assistant_repo.get_owner_ids(assistant_id)
    await refresh_owner_details(owner_ids, db)
    await assistant_repo.update(
        assistant_id=assistant_id,
        owner_ids=owner_ids,
        assistant=assistant,
    )
    await assistant_repo.record_audit_event(
        assistant_id=assistant_id,
        actor_user_id=_admin.user_id,
        actor_name=_admin.name,
        action="owners_updated",
        before={"owner_ids": previous_owner_ids},
        after={"owner_ids": owner_ids},
    )
    await db.commit()
    refreshed_assistant = await assistant_repo.get_with_owners(assistant_id)
    return (
        await _build_assistant_response_list([refreshed_assistant], assistant_repo)
    )[0]


@router.get(
    "/admin/assistant/{assistant_id}/tool-grants",
    response_model=list[AssistantToolGrantResponse],
    summary="List restricted tools available to an assistant",
    tags=["Admin"],
)
async def list_tool_grants(
    assistant_id: str,
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> list[AssistantToolGrantResponse]:
    """Return active administrator-managed restricted-tool grants."""
    assistant_repo = AssistantRepository(db)
    if await assistant_repo.get(assistant_id) is None:
        raise AssistantNotFoundException(assistant_id)
    grants = await assistant_repo.list_active_tool_grants(assistant_id)
    return [AssistantToolGrantResponse.model_validate(grant) for grant in grants]


@router.put(
    "/admin/assistant/{assistant_id}/tool-grants/{tool_id:path}",
    response_model=AssistantToolGrantResponse,
    summary="Make a restricted tool available to an assistant",
    tags=["Admin"],
)
async def grant_tool(
    assistant_id: str,
    tool_id: str,
    grant_update: AssistantToolGrantUpdate,
    db: AsyncSession = Depends(get_db_session),
    admin: AuthenticationResult = Depends(require_admin),
) -> AssistantToolGrantResponse:
    """Grant availability only; assistant owners still choose whether to configure it."""
    assistant_repo = AssistantRepository(db)
    if await assistant_repo.get_for_update(assistant_id) is None:
        raise AssistantNotFoundException(assistant_id)

    grant = await assistant_repo.grant_tool(
        assistant_id=assistant_id,
        tool_id=tool_id,
        granted_by=admin.user_id,
        reason=grant_update.reason,
    )
    response = AssistantToolGrantResponse.model_validate(grant)
    await db.commit()
    return response


@router.delete(
    "/admin/assistant/{assistant_id}/tool-grants/{tool_id:path}",
    status_code=204,
    summary="Revoke a restricted tool from an assistant",
    tags=["Admin"],
)
async def revoke_tool(
    assistant_id: str,
    tool_id: str,
    db: AsyncSession = Depends(get_db_session),
    admin: AuthenticationResult = Depends(require_admin),
) -> Response:
    """Revoke availability without changing the assistant's saved configuration."""
    assistant_repo = AssistantRepository(db)
    if await assistant_repo.get_for_update(assistant_id) is None:
        raise AssistantNotFoundException(assistant_id)
    if not await assistant_repo.revoke_tool(assistant_id, tool_id, admin.user_id):
        raise HTTPException(status_code=404, detail="Active tool grant not found")

    await db.commit()
    return Response(status_code=204)


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
    assistant = await assistant_repo.get_for_update(assistant_id)
    if assistant is None:
        raise AssistantNotFoundException(assistant_id)

    if not await assistant_repo.claim_version_update(assistant):
        await db.rollback()
        current_version = await assistant_repo.get_latest_version(assistant_id)
        raise VersionConflictException(
            state_update.version,
            current_version.version if current_version is not None else "none",
        )

    latest_version = await assistant_repo.get_latest_version(assistant_id)
    if latest_version is None or latest_version.version != state_update.version:
        raise VersionConflictException(
            state_update.version,
            latest_version.version if latest_version is not None else "none",
        )
    if latest_version.state != state_update.expected_state:
        raise VersionConflictException(state_update.version, latest_version.version)
    if latest_version.state != AssistantState.PENDING_LEGAL_REVIEW:
        raise HTTPException(
            status_code=409,
            detail="Only assistants pending legal review can receive an admin state update",
        )
    if state_update.state not in (AssistantState.ACTIVE, AssistantState.INACTIVE):
        raise HTTPException(
            status_code=422,
            detail="Admin state updates must target active or inactive",
        )

    try:
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
        await assistant_repo.record_audit_event(
            assistant_id=assistant_id,
            actor_user_id=admin.user_id,
            actor_name=admin.name,
            action="state_updated",
            before={"state": latest_version.state, "version": latest_version.version},
            after={"state": state_update.state, "version": review_version.version},
            reason=state_update.reason,
            assistant_version=review_version.version,
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        current_version = await assistant_repo.get_latest_version(assistant_id)
        raise VersionConflictException(
            state_update.version,
            current_version.version if current_version is not None else "none",
        ) from None

    refreshed_assistant = await assistant_repo.get_with_owners(assistant_id)
    return (
        await _build_assistant_response_list([refreshed_assistant], assistant_repo)
    )[0]


@router.get(
    "/admin/assistant/{assistant_id}/audit-events",
    response_model=list[AssistantAuditEventResponse],
    summary="List assistant audit events",
    tags=["Admin"],
)
async def get_assistant_audit_events(
    assistant_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db_session),
    _admin: AuthenticationResult = Depends(require_admin),
) -> list[AssistantAuditEventResponse]:
    """Return the immutable administrative and configuration history."""
    assistant_repo = AssistantRepository(db)
    events = await assistant_repo.get_audit_events(
        assistant_id, offset=offset, limit=limit
    )
    if not events and await assistant_repo.get(assistant_id) is None:
        raise AssistantNotFoundException(assistant_id)
    return [AssistantAuditEventResponse.model_validate(event) for event in events]
