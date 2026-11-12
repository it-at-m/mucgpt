"""Background lifecycle for chat images: durable object cleanup.

PostgreSQL catalog rows and S3 objects cannot be deleted atomically, so every
catalog deletion enqueues an outbox entry inside its own transaction and this
job removes the bytes afterwards. The job is idempotent and safe to run
concurrently (``FOR UPDATE SKIP LOCKED`` leasing on PostgreSQL) and is hosted
by the ``app.maintenance`` entrypoint on a schedule instead of living inside
the API process.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config.settings import ImageConfig
from core.image_store import ImageStore
from core.logtools import getLogger
from database.database_models import Chat, ChatImage
from database.image_repo import ImageDeletionOutboxRepository

logger = getLogger()

DEFAULT_LEASE_SECONDS = 300
DEFAULT_BATCH_LIMIT = 100
DEFAULT_RETRY_DELAY_SECONDS = 300


@dataclass(frozen=True)
class LifecycleRunResult:
    """What one job pass removed and what is still pending."""

    deleted_objects: int = 0
    failed_deletions: int = 0
    swept_expired_drafts: int = 0
    swept_retired_conversation_images: int = 0


async def enqueue_raw(
    connection, *, bucket: str, object_key: str, reason: str
) -> None:
    """Insert an outbox entry over a raw DBAPI connection (no session).

    Used by ``PersistanceHelpers.erase_conversation``, whose fenced deletion
    transaction runs on the persistence pool; the entry commits together with
    the catalog deletes.
    """
    await connection.execute(
        "INSERT INTO image_deletion_outbox (id, bucket, object_key, reason) "
        "VALUES (%s, %s, %s, %s)",
        (str(uuid4()), bucket, object_key, reason),
    )


async def sweep_expired_drafts(
    session_factory: async_sessionmaker[AsyncSession],
) -> int:
    """Expire unbound ready drafts: drop the row and queue object removal."""
    now = datetime.now(UTC)
    async with session_factory.begin() as session:
        rows = (
            await session.execute(
                select(ChatImage).where(
                    ChatImage.status == "ready",
                    ChatImage.conversation_id.is_(None),
                    ChatImage.expires_at.is_not(None),
                    ChatImage.expires_at <= now,
                )
            )
        ).scalars().all()
        for row in rows:
            repository = ImageDeletionOutboxRepository(session)
            await repository.enqueue(row.bucket, row.object_key, "expired")
            await session.execute(delete(ChatImage).where(ChatImage.id == row.id))
        return len(rows)


async def sweep_retired_conversation_images(
    session_factory: async_sessionmaker[AsyncSession],
) -> int:
    """Queue removal of images bound to retired conversations.

    Covers both explicit deletion (``chats.deleted_at`` set by
    ``erase_conversation``) and rows whose conversation row vanished without a
    tombstone; both leave the image unreachable, so its bytes are personal
    data with no remaining owner path.
    """
    async with session_factory.begin() as session:
        rows = (
            await session.execute(
                select(ChatImage)
                .outerjoin(Chat, Chat.conversation_id == ChatImage.conversation_id)
                .where(
                    ChatImage.conversation_id.is_not(None),
                    ChatImage.status == "ready",
                    or_(
                        Chat.deleted_at.is_not(None),
                        Chat.conversation_id.is_(None),
                    ),
                )
            )
        ).scalars().all()
        for row in rows:
            repository = ImageDeletionOutboxRepository(session)
            await repository.enqueue(
                row.bucket, row.object_key, "conversation_deleted"
            )
            await session.execute(delete(ChatImage).where(ChatImage.id == row.id))
        return len(rows)


async def _drain_outbox(
    session_factory: async_sessionmaker[AsyncSession],
    store: ImageStore,
    configured_bucket: str,
    *,
    limit: int = DEFAULT_BATCH_LIMIT,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
    retry_delay_seconds: int = DEFAULT_RETRY_DELAY_SECONDS,
) -> tuple[int, int]:
    """Claim due outbox entries and delete their objects.

    Leases commit before the object call so a crash mid-run only delays the
    deletion until the lease expires. An object whose recorded bucket no
    longer matches the configuration cannot be deleted with the running
    credentials; the entry is failed with backoff so the mismatch stays
    visible instead of being silently dropped.
    """
    deleted = 0
    failed = 0
    while True:
        async with session_factory.begin() as session:
            claimed = await ImageDeletionOutboxRepository(session).claim_due(
                limit=limit, lease_seconds=lease_seconds
            )
        if not claimed:
            break
        for entry in claimed:
            try:
                if entry.bucket != configured_bucket:
                    raise RuntimeError(f"foreign bucket {entry.bucket!r}")
                await store.delete(entry.object_key)
            except Exception as exc:
                logger.warning(
                    "Object deletion deferred for %s (attempt %s): %s",
                    entry.object_key,
                    entry.attempts,
                    exc,
                )
                async with session_factory.begin() as session:
                    await ImageDeletionOutboxRepository(session).record_failure(
                        entry.id,
                        str(exc)[:500],
                        retry_delay_seconds=retry_delay_seconds,
                    )
                failed += 1
            else:
                async with session_factory.begin() as session:
                    await ImageDeletionOutboxRepository(session).record_success(
                        entry.id
                    )
                deleted += 1
        if len(claimed) < limit:
            break
    return deleted, failed


async def run_once(
    session_factory: async_sessionmaker[AsyncSession],
    store: ImageStore,
    settings: ImageConfig,
) -> LifecycleRunResult:
    """Run one full lifecycle pass: sweeps first, then outbox drain.

    Sweeps run before the drain so objects queued by this pass are removed in
    the same invocation instead of waiting for the next scheduled run.
    """
    swept_expired = (
        await sweep_expired_drafts(session_factory) if settings.enabled else 0
    )
    swept_retired = (
        await sweep_retired_conversation_images(session_factory)
        if settings.enabled
        else 0
    )
    deleted, failed = await _drain_outbox(
        session_factory, store, settings.s3.bucket if settings.s3 else ""
    )
    return LifecycleRunResult(
        deleted_objects=deleted,
        failed_deletions=failed,
        swept_expired_drafts=swept_expired,
        swept_retired_conversation_images=swept_retired,
    )
