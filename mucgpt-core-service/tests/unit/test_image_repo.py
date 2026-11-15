"""Owner-scoped catalog operations for chat images (SQLite contract tests)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from database.database_models import Base, Chat, ChatImage
from database.image_repo import (
    ImageAlreadyBoundError,
    ImageConversationUnavailableError,
    ImageRepository,
    ImageUnavailableError,
)


@pytest.fixture
def engine():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[ChatImage.__table__])
    yield engine
    engine.dispose()


def async_session(session):
    """Adapt the sync Session to the async repository execute contract."""
    return MagicMock(execute=AsyncMock(side_effect=session.execute))
IMAGE_ID = "11111111-1111-4111-8111-111111111111"


@pytest.mark.asyncio
async def test_reserve_and_mark_ready_publish_metadata(engine):
    with Session(engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        reserved = await repository.reserve_image(
            "owner",
            filename="shot.png",
            mime_type="image/png",
            size_bytes=10,
            sha256="a" * 64,
            bucket="bucket",
            object_key="123.png",
        )
        image_id = reserved.id
        created_at = reserved.created_at
        published = await repository.mark_ready(
            "owner", image_id, expires_at=datetime.now(UTC) + timedelta(hours=24)
        )

    assert published is True
    with Session(engine) as session:
        ready = session.get(ChatImage, image_id)
        assert ready.status == "ready"
        assert ready.expires_at is not None
        assert ready.created_at == created_at


@pytest.mark.asyncio
async def test_get_ready_image_scopes_to_owner(engine):
    with Session(engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        await repository.reserve_image(
            "owner",
            filename="shot.png",
            mime_type="image/png",
            size_bytes=10,
            sha256="a" * 64,
            bucket="bucket",
            object_key="123.png",
            image_id=IMAGE_ID,
        )
        published = await repository.mark_ready(
            "owner", IMAGE_ID, expires_at=datetime.now(UTC) + timedelta(hours=1)
        )
        assert published is True

    with Session(engine) as session:
        repository = ImageRepository(async_session(session))
        assert (await repository.get_ready_image("owner", IMAGE_ID)) is not None
        assert (await repository.get_ready_image("attacker", IMAGE_ID)) is None


@pytest.mark.asyncio
async def test_delete_image_only_removes_unbound_drafts(engine):
    with Session(engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        await repository.reserve_image(
            "owner",
            filename="shot.png",
            mime_type="image/png",
            size_bytes=10,
            sha256="a" * 64,
            bucket="bucket",
            object_key="123.png",
            image_id=IMAGE_ID,
        )
        assert (await repository.delete_image("attacker", IMAGE_ID)) is False
        assert (await repository.delete_image("owner", IMAGE_ID)) is True

    with Session(engine) as session:
        assert session.get(ChatImage, IMAGE_ID) is None


@pytest.fixture
def binding_engine():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[Chat.__table__, ChatImage.__table__])
    yield engine
    engine.dispose()


def seed_chat(engine, conversation_id="conv-1", user_id="owner", retired=None):

    with Session(engine) as session, session.begin():
        session.add(
            Chat(
                conversation_id=conversation_id,
                user_id=user_id,
                deleted_at=retired,
                chat_title="Chat",
            )
        )


def seed_image(engine, image_id, *, bound_to=None, status="ready", expires_offset=24):
    with Session(engine) as session, session.begin():
        session.add(
            ChatImage(
                id=image_id,
                owner_user_id="owner",
                bucket="bucket",
                object_key=f"{image_id}.png",
                mime_type="image/png",
                size_bytes=10,
                sha256="a" * 64,
                original_filename="shot.png",
                status=status,
                conversation_id=bound_to,
                bound_at=datetime.now(UTC) if bound_to else None,
                expires_at=(
                    None
                    if bound_to
                    else datetime.now(UTC) + timedelta(hours=expires_offset)
                ),
            )
        )


@pytest.mark.asyncio
async def test_binding_persists_and_is_idempotent(binding_engine):
    seed_chat(binding_engine)
    seed_image(binding_engine, IMAGE_ID)

    with Session(binding_engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        bound = await repository.bind_images_to_conversation(
            "owner", "conv-1", [IMAGE_ID, IMAGE_ID]
        )
        assert bound == 1
        again = await repository.bind_images_to_conversation(
            "owner", "conv-1", [IMAGE_ID]
        )
        assert again == 1

    with Session(binding_engine) as session:
        row = session.get(ChatImage, IMAGE_ID)
        assert row.conversation_id == "conv-1"
        assert row.bound_at is not None
        assert row.expires_at is None


@pytest.mark.asyncio
async def test_binding_rejects_foreign_conversations(binding_engine):
    seed_image(binding_engine, IMAGE_ID)

    for conversation_id, user in [("missing", "owner"), ("conv-1", "attacker")]:
        with Session(binding_engine) as session, session.begin():
            repository = ImageRepository(async_session(session))
            with pytest.raises(ImageConversationUnavailableError):
                await repository.bind_images_to_conversation(
                    user, conversation_id, [IMAGE_ID]
                )


@pytest.mark.asyncio
async def test_binding_rejects_images_bound_elsewhere(binding_engine):
    seed_chat(binding_engine)
    seed_chat(binding_engine, conversation_id="other", user_id="owner")
    seed_image(binding_engine, IMAGE_ID, bound_to="other")

    with Session(binding_engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        with pytest.raises(ImageAlreadyBoundError):
            await repository.bind_images_to_conversation(
                "owner", "conv-1", [IMAGE_ID]
            )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,expires_offset",
    [("deleting", 24), ("uploading", 24), ("ready", -1)],
)
async def test_binding_rejects_unavailable_images(
    binding_engine, status, expires_offset
):
    seed_chat(binding_engine)
    seed_image(binding_engine, IMAGE_ID, status=status, expires_offset=expires_offset)

    with Session(binding_engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        with pytest.raises(ImageUnavailableError):
            await repository.bind_images_to_conversation(
                "owner", "conv-1", [IMAGE_ID]
            )


@pytest.mark.asyncio
async def test_verify_unbound_accepts_and_rejects_stateless_references(
    binding_engine,
):
    seed_image(binding_engine, IMAGE_ID)
    bound_id = "99999999-9999-4999-8999-999999999999"
    seed_image(binding_engine, bound_id, bound_to="conv-1")
    foreign_id = "88888888-8888-4888-8888-888888888888"
    seed_image(binding_engine, foreign_id, status="uploading")

    with Session(binding_engine) as session, session.begin():
        repository = ImageRepository(async_session(session))
        assert (await repository.verify_unbound_images("owner", [IMAGE_ID])) == 1
        with pytest.raises(ImageAlreadyBoundError):
            await repository.verify_unbound_images("owner", [bound_id])
        with pytest.raises(ImageUnavailableError):
            await repository.verify_unbound_images("owner", [foreign_id])
        with pytest.raises(ImageUnavailableError):
            await repository.verify_unbound_images("attacker", [IMAGE_ID])


class TestImageDeletionOutboxRepository:
    @pytest.fixture
    def outbox_engine(self):
        from database.database_models import ImageDeletionOutbox

        engine = create_engine("sqlite://")
        Base.metadata.create_all(
            engine, tables=[ChatImage.__table__, ImageDeletionOutbox.__table__]
        )
        yield engine
        engine.dispose()

    @pytest.mark.asyncio
    async def test_enqueue_records_reason_and_due_time(self, outbox_engine):
        from database.database_models import ImageDeletionOutbox
        from database.image_repo import ImageDeletionOutboxRepository

        with Session(outbox_engine) as session, session.begin():
            await ImageDeletionOutboxRepository(async_session(session)).enqueue(
                "b1", "k1.png", "draft_delete"
            )
        with Session(outbox_engine) as session:
            entry = session.query(ImageDeletionOutbox).one()
            assert (entry.bucket, entry.object_key, entry.reason) == (
                "b1",
                "k1.png",
                "draft_delete",
            )
            assert entry.attempts == 0
            assert entry.next_attempt_at is not None

    @pytest.mark.asyncio
    async def test_enqueue_rejects_unknown_reason(self, outbox_engine):
        from database.image_repo import ImageDeletionOutboxRepository

        with Session(outbox_engine) as session, session.begin():
            with pytest.raises(ValueError):
                await ImageDeletionOutboxRepository(
                    async_session(session)
                ).enqueue("b1", "k1.png", "nonsense")

    @pytest.mark.asyncio
    async def test_claim_due_leases_and_counts_attempts(self, outbox_engine):
        from datetime import UTC, datetime, timedelta

        from database.database_models import ImageDeletionOutbox
        from database.image_repo import ImageDeletionOutboxRepository

        self._seed(outbox_engine, object_key="due.png")
        self._seed(
            outbox_engine,
            object_key="future.png",
            next_attempt_at=datetime.now(UTC) + timedelta(hours=1),
        )

        with Session(outbox_engine) as session, session.begin():
            claimed = await ImageDeletionOutboxRepository(
                async_session(session)
            ).claim_due(limit=10, lease_seconds=300)

        assert [entry.object_key for entry in claimed] == ["due.png"]
        with Session(outbox_engine) as session:
            entry = session.query(ImageDeletionOutbox).filter_by(
                object_key="due.png"
            ).one()
            assert entry.attempts == 1
            assert entry.lease_until is not None

    @pytest.mark.asyncio
    async def test_claim_skips_entries_under_active_lease(self, outbox_engine):
        from datetime import UTC, datetime, timedelta

        from database.database_models import ImageDeletionOutbox
        from database.image_repo import ImageDeletionOutboxRepository

        self._seed(outbox_engine)
        with Session(outbox_engine) as session, session.begin():
            session.query(ImageDeletionOutbox).update(
                {
                    "lease_until": datetime.now(UTC)
                    + timedelta(seconds=300)
                }
            )
        with Session(outbox_engine) as session, session.begin():
            claimed = await ImageDeletionOutboxRepository(
                async_session(session)
            ).claim_due(limit=10, lease_seconds=300)
        assert claimed == []

    @pytest.mark.asyncio
    async def test_success_removes_entry_and_failure_schedules_retry(
        self, outbox_engine
    ):
        from datetime import UTC, datetime, timedelta

        from database.database_models import ImageDeletionOutbox
        from database.image_repo import ImageDeletionOutboxRepository

        self._seed(outbox_engine, object_key="a.png")
        self._seed(outbox_engine, object_key="b.png")
        with Session(outbox_engine) as session, session.begin():
            claimed = await ImageDeletionOutboxRepository(
                async_session(session)
            ).claim_due(limit=10, lease_seconds=300)
        with Session(outbox_engine) as session, session.begin():
            repository = ImageDeletionOutboxRepository(async_session(session))
            await repository.record_success(claimed[0].id)
            await repository.record_failure(
                claimed[1].id, "storage down", retry_delay_seconds=60
            )
        with Session(outbox_engine) as session:
            remaining = session.query(ImageDeletionOutbox).all()
            assert len(remaining) == 1
            assert remaining[0].object_key == "b.png"
            assert remaining[0].last_error == "storage down"
            assert remaining[0].lease_until is None
            next_attempt = remaining[0].next_attempt_at
            if next_attempt.tzinfo is None:
                next_attempt = next_attempt.replace(tzinfo=UTC)
            assert next_attempt > datetime.now(UTC)
            assert next_attempt <= datetime.now(UTC) + timedelta(seconds=120)

    @staticmethod
    def _seed(engine, *, object_key="k.png", next_attempt_at=None):
        from database.database_models import ImageDeletionOutbox

        with Session(engine) as session, session.begin():
            session.add(
                ImageDeletionOutbox(
                    id=str(uuid4()),
                    bucket="b1",
                    object_key=object_key,
                    reason="draft_delete",
                    next_attempt_at=next_attempt_at,
                )
            )
