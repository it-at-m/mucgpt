"""POST /v1/conversations/import, used once per chat by the frontend."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio.lock import Lock

# same lock as chat turns, so an import can't race a running chat
from api.routers.chat_router import _lock_conversation_run, _unlock_conversation_run
from chat_migration.models import ConversationImportRequest, ConversationImportResult
from chat_migration.service import ImportConflictError, import_chat
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.logtools import getLogger

logger = getLogger()

IMPORT_SLOT_PREFIX = "chat_migration_import_slot"
IMPORT_RETRY_AFTER_SECONDS = 5

router = APIRouter(prefix="/v1")


async def _acquire_import_slot() -> Lock | None:
    """Claim one bounded, Redis-backed import lease across all core instances."""
    settings = get_settings()
    redis = await RedisCache.get_redis()
    for index in range(settings.chat_migration_max_concurrent_imports):
        slot = redis.lock(
            f"{IMPORT_SLOT_PREFIX}:{index}",
            timeout=settings.chat_migration_slot_ttl_seconds,
            blocking_timeout=0,
        )
        if await slot.acquire():
            return slot
    return None


async def _release_import_slot(slot: Lock) -> None:
    try:
        await slot.release()
    except Exception:
        logger.warning("Chat migration import slot expired before the import ended")


@router.post(
    "/conversations/import",
    summary="Import a browser-only conversation",
    response_model=ConversationImportResult,
    responses={
        409: {"description": "Conversation id not available"},
        423: {"description": "Conversation is busy; retry after the supplied delay"},
        429: {
            "description": "Browser chat migration capacity is temporarily exhausted"
        },
    },
)
async def import_conversation(
    request: ConversationImportRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
    response: Response,
) -> ConversationImportResult:
    """Store a chat from the browser once; repeating it returns skipped."""
    import_slot = await _acquire_import_slot()
    if import_slot is None:
        raise HTTPException(
            status_code=429,
            detail="Browser chat migration capacity is temporarily exhausted",
            headers={"Retry-After": str(IMPORT_RETRY_AFTER_SECONDS)},
        )
    try:
        try:
            lock = await _lock_conversation_run(request.conversation_id)
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            raise HTTPException(
                status_code=423,
                detail="Another request is still running for this conversation",
                headers={"Retry-After": str(IMPORT_RETRY_AFTER_SECONDS)},
            ) from exc
        try:
            status = await import_chat(request, user_info.user_id)
        except ImportConflictError as exc:
            raise HTTPException(
                status_code=409, detail="Conversation id is not available"
            ) from exc
        finally:
            await _unlock_conversation_run(lock)
    finally:
        await _release_import_slot(import_slot)
    # counts only, never chat content
    logger.info("Browser chat import: %s", status)
    response.headers["Cache-Control"] = "no-store"
    return ConversationImportResult(status=status)
