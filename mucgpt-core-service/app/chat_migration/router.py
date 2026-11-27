"""POST /v1/conversations/import, used once per chat by the frontend."""

import asyncio
from contextlib import suppress
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio.lock import Lock
from redis.exceptions import LockError

# same lock as chat turns, so an import can't race a running chat
from api.routers.chat_router import (
    _lock_conversation_run,
    _renew_conversation_run_lock,
    _unlock_conversation_run,
)
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


async def _renew_import_slot(
    slot: Lock, lease_seconds: int, stop: asyncio.Event
) -> bool:
    """Keep an import slot claimed when an unusually large import runs slowly."""
    while not stop.is_set():
        await asyncio.sleep(lease_seconds / 2)
        if stop.is_set():
            return True
        try:
            if not await slot.extend(lease_seconds, replace_ttl=True):
                logger.warning("Chat migration import slot could not be renewed")
                return False
        except LockError:
            logger.warning("Chat migration import slot expired before it could renew")
            return False
        except Exception:
            logger.exception("Chat migration import slot renewal failed")
            return False
    return True


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
        503: {"description": "Browser chat migration lease was lost; retry the import"},
    },
)
async def import_conversation(
    request: ConversationImportRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
    response: Response,
) -> ConversationImportResult:
    """Store a chat from the browser once; repeating it returns skipped."""
    # conversation lock first: waiting on a busy chat must not hold a global import slot
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
    lock_renewal_stop = asyncio.Event()
    lock_renewal = asyncio.create_task(
        _renew_conversation_run_lock(lock, lock_renewal_stop)
    )
    try:
        import_slot = await _acquire_import_slot()
        if import_slot is None:
            raise HTTPException(
                status_code=429,
                detail="Browser chat migration capacity is temporarily exhausted",
                headers={"Retry-After": str(IMPORT_RETRY_AFTER_SECONDS)},
            )
        slot_renewal_stop = asyncio.Event()
        slot_renewal = asyncio.create_task(
            _renew_import_slot(
                import_slot,
                get_settings().chat_migration_slot_ttl_seconds,
                slot_renewal_stop,
            )
        )
        import_task = asyncio.create_task(import_chat(request, user_info.user_id))
        try:
            done, _ = await asyncio.wait(
                (import_task, slot_renewal),
                return_when=asyncio.FIRST_COMPLETED,
            )
            if (
                slot_renewal in done
                and not slot_renewal.result()
                and not import_task.done()
            ):
                import_task.cancel()
                with suppress(asyncio.CancelledError):
                    await import_task
                raise HTTPException(
                    status_code=503,
                    detail="Browser chat migration capacity lease was lost; retry the import",
                    headers={"Retry-After": str(IMPORT_RETRY_AFTER_SECONDS)},
                )
            status = await import_task
        except ImportConflictError as exc:
            raise HTTPException(
                status_code=409, detail="Conversation id is not available"
            ) from exc
        finally:
            slot_renewal_stop.set()
            slot_renewal.cancel()
            with suppress(asyncio.CancelledError):
                await slot_renewal
            if not import_task.done():
                import_task.cancel()
                with suppress(asyncio.CancelledError):
                    await import_task
            await _release_import_slot(import_slot)
    finally:
        lock_renewal_stop.set()
        lock_renewal.cancel()
        with suppress(asyncio.CancelledError):
            await lock_renewal
        await _unlock_conversation_run(lock)
    # counts only, never chat content
    logger.info("Browser chat import: %s", status)
    response.headers["Cache-Control"] = "no-store"
    return ConversationImportResult(status=status)
