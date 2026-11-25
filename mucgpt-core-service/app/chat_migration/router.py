"""POST /v1/conversations/import, used once per chat by the frontend."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

# same lock as chat turns, so an import can't race a running chat
from api.routers.chat_router import _lock_conversation_run, _unlock_conversation_run
from chat_migration.models import ConversationImportRequest, ConversationImportResult
from chat_migration.service import ImportConflictError, import_chat
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger

logger = getLogger()

router = APIRouter(prefix="/v1")


@router.post(
    "/conversations/import",
    summary="Import a browser-only conversation",
    response_model=ConversationImportResult,
    responses={
        409: {"description": "Conversation id not available"},
        423: {"description": "Conversation is busy; retry after the supplied delay"},
    },
)
async def import_conversation(
    request: ConversationImportRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
    response: Response,
) -> ConversationImportResult:
    """Store a chat from the browser once; repeating it returns skipped."""
    try:
        lock = await _lock_conversation_run(request.conversation_id)
    except HTTPException as exc:
        if exc.status_code != 409:
            raise
        raise HTTPException(
            status_code=423,
            detail="Another request is still running for this conversation",
            headers={"Retry-After": "5"},
        ) from exc
    try:
        status = await import_chat(request, user_info.user_id)
    except ImportConflictError as exc:
        raise HTTPException(
            status_code=409, detail="Conversation id is not available"
        ) from exc
    finally:
        await _unlock_conversation_run(lock)
    # counts only, never chat content
    logger.info("Browser chat import: %s", status)
    response.headers["Cache-Control"] = "no-store"
    return ConversationImportResult(status=status)
