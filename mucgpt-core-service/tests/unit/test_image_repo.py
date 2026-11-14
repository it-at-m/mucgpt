"""Owner-scoped catalog operations for chat images (SQLite contract tests)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

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
