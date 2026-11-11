"""Owner-scoped catalog operations for chat images (SQLite contract tests)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from database.database_models import Base, ChatImage
from database.image_repo import ImageRepository


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
