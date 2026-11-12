"""Lifecycle job behavior for chat images (SQLite contract tests)."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session

from config.settings import ImageConfig, ImageStorageConfig
from core.image_lifecycle import run_once, sweep_expired_drafts
from database.database_models import Base, Chat, ChatImage, ImageDeletionOutbox

USER_ID = "owner-1"
CONVERSATION_ID = "conv-1"
BUCKET = "test-bucket"


class FakeImageStore:
    def __init__(self):
        self.objects: set[str] = set()
        self.deleted: list[str] = []
        self.fail_delete = False

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects.add(key)

    async def get(self, key: str, max_bytes: int) -> bytes:
        return b""

    async def delete(self, key: str) -> None:
        if self.fail_delete:
            raise RuntimeError("storage unavailable")
        self.deleted.append(key)
        self.objects.discard(key)


class _SessionAdapter:
    """SQLite-backed adapter for the async session factory contract."""

    def __init__(self, engine):
        self.engine = engine

    @asynccontextmanager
    async def _use(self, *, begin: bool):
        with Session(self.engine) as session:
            wrapped = MagicMock(execute=AsyncMock(side_effect=session.execute))
            if begin:
                with session.begin():
                    yield wrapped
            else:
                yield wrapped

    def __call__(self):
        return self._use(begin=False)

    def begin(self):
        return self._use(begin=True)


def expired_stamp(seconds_ago=60):
    return datetime.now(UTC) - timedelta(seconds=seconds_ago)


@pytest.fixture
def lifecycle_env():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[Chat.__table__, ChatImage.__table__, ImageDeletionOutbox.__table__],
    )
    store = FakeImageStore()
    settings = ImageConfig(enabled=True, s3=ImageStorageConfig(bucket=BUCKET))

    def seed_image(
        image_id,
        *,
        object_key=None,
        conversation_id=None,
        expires_at=None,
        status="ready",
    ):
        key = object_key or f"{image_id}.png"
        with Session(engine) as session, session.begin():
            session.add(
                ChatImage(
                    id=image_id,
                    owner_user_id=USER_ID,
                    bucket=BUCKET,
                    object_key=key,
                    mime_type="image/png",
                    size_bytes=10,
                    sha256="a" * 64,
                    original_filename="shot.png",
                    status=status,
                    conversation_id=conversation_id,
                    bound_at=datetime.now(UTC) if conversation_id else None,
                    expires_at=expires_at,
                )
            )
        store.objects.add(key)

    def seed_chat(conversation_id, *, retired=False):
        with Session(engine) as session, session.begin():
            session.add(
                Chat(
                    conversation_id=conversation_id,
                    user_id=USER_ID,
                    chat_title="Chat",
                    deleted_at=datetime.now(UTC) if retired else None,
                )
            )

    def enqueue(*, object_key, bucket=BUCKET, reason="draft_delete"):
        with Session(engine) as session, session.begin():
            session.add(
                ImageDeletionOutbox(
                    id=str(uuid4()),
                    bucket=bucket,
                    object_key=object_key,
                    reason=reason,
                )
            )
        store.objects.add(object_key)

    def outbox_rows():
        with Session(engine) as session:
            return list(session.query(ImageDeletionOutbox).all())

    def image_rows():
        with Session(engine) as session:
            return list(session.query(ChatImage).all())

    yield SimpleNamespace(
        engine=engine,
        store=store,
        settings=settings,
        factory=_SessionAdapter(engine),
        seed_image=seed_image,
        seed_chat=seed_chat,
        enqueue=enqueue,
        outbox_rows=outbox_rows,
        image_rows=image_rows,
    )
    engine.dispose()


@pytest.mark.asyncio
async def test_expired_unbound_drafts_are_swept(lifecycle_env):
    env = lifecycle_env
    env.seed_image("img-1", expires_at=expired_stamp())
    env.seed_image("img-2", expires_at=expired_stamp())
    env.seed_image("img-live", expires_at=datetime.now(UTC) + timedelta(hours=1))

    swept = await sweep_expired_drafts(env.factory)

    assert swept == 2
    assert sorted(row.object_key for row in env.outbox_rows()) == [
        "img-1.png",
        "img-2.png",
    ]
    assert [row.id for row in env.image_rows()] == ["img-live"]


@pytest.mark.asyncio
async def test_bound_drafts_are_never_expired(lifecycle_env):
    env = lifecycle_env
    env.seed_image(
        "img-bound", conversation_id=CONVERSATION_ID, expires_at=expired_stamp()
    )

    swept = await sweep_expired_drafts(env.factory)

    assert swept == 0
    assert [row.id for row in env.image_rows()] == ["img-bound"]


@pytest.mark.asyncio
async def test_run_once_drains_outbox_and_deletes_objects(lifecycle_env):
    env = lifecycle_env
    env.enqueue(object_key="gone.png")

    result = await run_once(env.factory, env.store, env.settings)

    assert result.deleted_objects == 1
    assert result.failed_deletions == 0
    assert env.store.deleted == ["gone.png"]
    assert env.outbox_rows() == []


@pytest.mark.asyncio
async def test_run_once_sweeps_retired_conversation_images(lifecycle_env):
    env = lifecycle_env
    env.seed_chat(CONVERSATION_ID, retired=True)
    env.seed_image("img-retired", conversation_id=CONVERSATION_ID)

    result = await run_once(env.factory, env.store, env.settings)

    assert result.swept_retired_conversation_images == 1
    assert env.image_rows() == []
    assert env.outbox_rows() == []
    assert env.store.deleted == ["img-retired.png"]


@pytest.mark.asyncio
async def test_live_conversation_images_are_untouched(lifecycle_env):
    env = lifecycle_env
    env.seed_chat(CONVERSATION_ID)
    env.seed_image("img-live", conversation_id=CONVERSATION_ID)

    result = await run_once(env.factory, env.store, env.settings)

    assert result.swept_retired_conversation_images == 0
    assert [row.id for row in env.image_rows()] == ["img-live"]
    assert env.outbox_rows() == []
    assert env.store.deleted == []


@pytest.mark.asyncio
async def test_failed_deletion_is_retried_after_backoff(lifecycle_env):
    env = lifecycle_env
    env.enqueue(object_key="stuck.png")
    env.store.fail_delete = True

    first = await run_once(env.factory, env.store, env.settings)

    assert first.failed_deletions == 1
    assert first.deleted_objects == 0
    entry = env.outbox_rows()[0]
    assert entry.attempts == 1
    assert "storage unavailable" in entry.last_error
    assert entry.lease_until is None

    with Session(env.engine) as session:
        session.execute(
            update(ImageDeletionOutbox).values(next_attempt_at=expired_stamp())
        )
        session.commit()
    env.store.fail_delete = False

    second = await run_once(env.factory, env.store, env.settings)

    assert second.deleted_objects == 1
    assert env.outbox_rows() == []


@pytest.mark.asyncio
async def test_foreign_bucket_entries_stay_visible(lifecycle_env):
    env = lifecycle_env
    env.enqueue(object_key="foreign.png", bucket="someone-elses")

    result = await run_once(env.factory, env.store, env.settings)

    assert result.failed_deletions == 1
    assert result.deleted_objects == 0
    entry = env.outbox_rows()[0]
    assert "foreign bucket" in entry.last_error


@pytest.mark.asyncio
async def test_disabled_image_input_skips_sweeps_but_drains(lifecycle_env):
    env = lifecycle_env
    env.seed_image("img-1", expires_at=expired_stamp())
    env.enqueue(object_key="pending.png")
    disabled = ImageConfig(enabled=False, s3=ImageStorageConfig(bucket=BUCKET))

    result = await run_once(env.factory, env.store, disabled)

    assert result.swept_expired_drafts == 0
    assert result.deleted_objects == 1
    assert [row.id for row in env.image_rows()] == ["img-1"]
    assert env.outbox_rows() == []
