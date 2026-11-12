"""Exercise the image ingestion pipeline with real catalog SQL and a fake store."""

import io
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import UploadFile
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from starlette.datastructures import Headers

from config.settings import ImageConfig, ImageStorageConfig
from core import image_service as services
from core.auth_models import AuthenticationResult
from core.image_store import ImageStorageError
from core.image_validation import InvalidImageError
from database.database_models import Base, ChatImage, ImageDeletionOutbox


class ImageSessions:
    """Adapt synchronous SQLite transactions to the async session contract."""

    def __init__(self, engine):
        self.engine = engine

    @asynccontextmanager
    async def begin(self):
        with Session(self.engine) as session, session.begin():
            yield MagicMock(execute=AsyncMock(side_effect=session.execute))

    def rows(self):
        with Session(self.engine) as session:
            return list(session.scalars(select(ChatImage)).all())


class FakeImageStore:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.deleted: list[str] = []

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = (data, content_type)

    async def get(self, key: str, max_bytes: int) -> bytes:
        return self.objects[key][0]

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.objects.pop(key, None)


def user(user_id="demo-user-9"):
    return AuthenticationResult(user_id=user_id, token="test", department="shared")


def image_bytes(fmt: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), color=(10, 20, 30)).save(buffer, format=fmt)
    return buffer.getvalue()


def upload(
    body: bytes,
    *,
    mime="image/png",
    size=None,
    filename="screenshot.png",
):
    return UploadFile(
        io.BytesIO(body),
        filename=filename,
        size=size,
        headers=Headers({"content-type": mime}),
    )


def settings() -> ImageConfig:
    return ImageConfig(
        enabled=True,
        s3=ImageStorageConfig(bucket="test-bucket", key_prefix="test-prefix/"),
    )


@pytest.fixture
def service():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[ChatImage.__table__, ImageDeletionOutbox.__table__])
    sessions = ImageSessions(engine)
    store = FakeImageStore()
    yield services.ImageIngestionService(sessions, store, settings()), sessions, store
    engine.dispose()


@pytest.mark.asyncio
async def test_successful_upload_publishes_ready_metadata(service):
    ingestion, sessions, store = service
    data = image_bytes()

    uploaded = await ingestion.ingest_image(user(), upload(data, size=1))

    # The understated supplied size must not be trusted; actual bytes win.
    assert uploaded.size_bytes == len(data)
    assert uploaded.mime_type == "image/png"
    assert (uploaded.width, uploaded.height) == (4, 4)
    assert uploaded.managed_url == f"mucgpt-image://{uploaded.id}"
    assert uploaded.expires_at > datetime.now(UTC)

    # One object stored under the bucket, keyed by the image id.
    [(key, (stored, content_type))] = store.objects.items()
    assert key == f"{uploaded.id}.png"
    assert stored == data
    assert content_type == "image/png"

    [row] = sessions.rows()
    assert row.id == uploaded.id
    assert row.status == "ready"
    assert row.owner_user_id == user().user_id
    assert row.bucket == "test-bucket"
    assert row.object_key == key
    assert row.sha256 and len(row.sha256) == 64
    assert row.expires_at is not None
    assert row.created_at == uploaded.created_at


@pytest.mark.asyncio
@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
async def test_format_and_extension_follow_the_actual_bytes(fmt, service):
    ingestion, _, store = service
    data = image_bytes(fmt)

    uploaded = await ingestion.ingest_image(
        user(), upload(data, filename="photo.unknown", mime="application/octet-stream")
    )

    assert uploaded.mime_type == f"image/{fmt.lower()}"
    extension = {"JPEG": "jpg", "WEBP": "webp"}.get(fmt, fmt.lower())
    assert store.objects[f"{uploaded.id}.{extension}"][0] == data


def oversized_service():
    """Service with a tiny byte bound for boundary tests."""
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[ChatImage.__table__, ImageDeletionOutbox.__table__])
    sessions = ImageSessions(engine)
    store = FakeImageStore()
    config = ImageConfig(
        enabled=True,
        max_upload_bytes=len(image_bytes()) - 1,
        s3=ImageStorageConfig(bucket="test-bucket"),
    )
    return services.ImageIngestionService(sessions, store, config), sessions, store, engine


@pytest.mark.asyncio
async def test_upload_above_the_byte_bound_is_rejected_before_storing():
    ingestion, sessions, store, engine = oversized_service()
    try:
        data = image_bytes()
        with pytest.raises(services.ImageSizeExceededError):
            await ingestion.ingest_image(user(), upload(data))
        assert sessions.rows() == []
        assert store.objects == {}
    finally:
        engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [b"", b"definitely not an image", image_bytes("GIF")],
)
async def test_invalid_uploads_are_rejected_without_reserving(service, body):
    ingestion, sessions, store = service

    with pytest.raises((InvalidImageError, services.ImageSizeExceededError)):
        await ingestion.ingest_image(user(), upload(body))

    assert sessions.rows() == []
    assert store.objects == {}


@pytest.mark.asyncio
async def test_store_failure_compensates_the_reservation(service):
    ingestion, sessions, store = service
    failing_store = FakeImageStore()
    failing_store.put = AsyncMock(side_effect=ImageStorageError("bucket unavailable"))
    failing = services.ImageIngestionService(
        ImageSessions(sessions.engine), failing_store, settings()
    )

    with pytest.raises(ImageStorageError):
        await failing.ingest_image(user(), upload(image_bytes()))

    assert failing_store.objects == {}
    assert sessions.rows() == []


@pytest.mark.asyncio
async def test_missing_filename_is_rejected(service):
    ingestion, sessions, _ = service

    with pytest.raises(services.InvalidImageUploadError):
        await ingestion.ingest_image(user(), upload(image_bytes(), filename=""))

    assert sessions.rows() == []


def test_expiry_default_is_twenty_four_hours():
    assert services.ImageIngestionService.__name__ == "ImageIngestionService"
    config = ImageConfig()
    assert config.unbound_expiry_seconds == 24 * 60 * 60
    assert datetime.now(UTC) + timedelta(seconds=config.unbound_expiry_seconds) > datetime.now(UTC)
