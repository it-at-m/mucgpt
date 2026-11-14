"""Router tests for the image upload/delivery endpoints (#1398)."""

import io
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from api.api_models import UploadedImageDTO
from backend import api_app
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import ImageConfig, ImageStorageConfig
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.image_store import ImageStorageError, ImageStorageManager
from database.database_models import Base, ChatImage, ImageDeletionOutbox
from database.image_catalog import ImageCatalogManager

USER_ID = "test_user_123"
OTHER_USER_ID = "someone-else"
VISION_MODEL = "vision-model"
PLAIN_MODEL = "text-model"


def image_bytes(fmt: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), color=(10, 20, 30)).save(buffer, format=fmt)
    return buffer.getvalue()


class ImageSessions:
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

    def rows(self):
        with Session(self.engine) as session:
            return list(session.scalars(select(ChatImage)).all())


class FakeImageStore:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.deleted: list[str] = []
        self.fail_delete = False

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = (data, content_type)

    async def get(self, key: str, max_bytes: int) -> bytes:
        return self.objects[key][0]

    async def delete(self, key: str) -> None:
        if self.fail_delete:
            raise ImageStorageError("storage unavailable")
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture
def image_env(monkeypatch: pytest.MonkeyPatch):
    """Real catalog SQL in SQLite plus a fake store and enabled settings."""
    engine = create_engine(
        "sqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(
        engine, tables=[ChatImage.__table__, ImageDeletionOutbox.__table__]
    )
    sessions = ImageSessions(engine)
    store = FakeImageStore()
    monkeypatch.setattr(ImageCatalogManager, "_session_factory", sessions)
    monkeypatch.setattr(ImageStorageManager, "_store", store)

    def apply_settings(enabled=True, **overrides):
        config = ImageConfig(
            enabled=enabled,
            s3=ImageStorageConfig(bucket="test-bucket"),
            **overrides,
        )
        monkeypatch.setattr(
            "api.routers.image_router.get_settings",
            lambda: SimpleNamespace(image_input=config),
        )
        return config

    yield SimpleNamespace(
        engine=engine,
        sessions=sessions,
        store=store,
        apply_settings=apply_settings,
    )
    engine.dispose()


@pytest.fixture(autouse=True)
def model_registry(monkeypatch: pytest.MonkeyPatch):
    def get_model(model_name: str | None = None, logger=None):
        if model_name in {VISION_MODEL, PLAIN_MODEL}:
            return Mock()
        raise ModelsConfigurationException(
            f"Model {model_name!r} not found in the registry"
        )

    monkeypatch.setattr(ModelRegistry, "get_model", get_model)
    monkeypatch.setattr(
        ModelRegistry, "is_vision_model", lambda model_name=None: False
    )


@pytest.fixture
def enable_vision(monkeypatch: pytest.MonkeyPatch):
    """Opt the upload target model into image input."""
    monkeypatch.setattr(
        ModelRegistry,
        "is_vision_model",
        lambda model_name=None: model_name == VISION_MODEL,
    )


def seed_row(engine, image_id: str, *, bound: bool = False):
    with Session(engine) as session, session.begin():
        session.add(
            ChatImage(
                id=image_id,
                owner_user_id=USER_ID,
                bucket="test-bucket",
                object_key=f"{image_id}.png",
                mime_type="image/png",
                size_bytes=len(image_bytes()),
                sha256="a" * 64,
                original_filename="shot.png",
                width=4,
                height=4,
                status="ready",
                conversation_id="conv-1" if bound else None,
                bound_at=datetime.now(UTC) if bound else None,
                expires_at=(
                    None
                    if bound
                    else datetime.now(UTC) + timedelta(hours=24)
                ),
            )
        )


def switch_user(user_id: str, original):
    async def _get_user():
        return AuthenticationResult(
            token="dummy_access_token",
            user_id=user_id,
            name="Other User",
            department="IT-Test-Department",
            is_authenticated=True,
        )

    api_app.dependency_overrides[authenticate_user] = _get_user
    return lambda: api_app.dependency_overrides.__setitem__(
        authenticate_user, original
    )


def test_upload_requires_enabled_image_input(test_client, image_env):
    image_env.apply_settings(enabled=False)

    response = test_client.post(
        "/v1/images",
        data={"model": VISION_MODEL},
        files={"file": ("shot.png", image_bytes(), "image/png")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Image upload is not enabled."


def test_upload_rejects_non_vision_model(test_client, image_env):
    image_env.apply_settings()

    response = test_client.post(
        "/v1/images",
        data={"model": PLAIN_MODEL},
        files={"file": ("shot.png", image_bytes(), "image/png")},
    )

    assert response.status_code == 400
    assert "supports_vision" in response.json()["detail"]


def test_upload_rejects_unknown_model(test_client, image_env):
    image_env.apply_settings()

    response = test_client.post(
        "/v1/images",
        data={"model": "does-not-exist"},
        files={"file": ("shot.png", image_bytes(), "image/png")},
    )

    assert response.status_code == 400


def test_upload_rejects_missing_model_field(test_client, image_env):
    image_env.apply_settings()

    response = test_client.post(
        "/v1/images", files={"file": ("shot.png", image_bytes(), "image/png")}
    )

    assert response.status_code == 422


def test_successful_upload_publishes_managed_metadata(test_client, image_env, enable_vision):
    image_env.apply_settings()

    response = test_client.post(
        "/v1/images",
        data={"model": VISION_MODEL},
        files={"file": ("shot.png", image_bytes(), "image/png")},
    )

    assert response.status_code == 201, response.text
    body = UploadedImageDTO.model_validate(response.json())
    assert body.mime_type == "image/png"
    assert body.managed_url == f"mucgpt-image://{body.id}"

    [(key, (data, content_type))] = image_env.store.objects.items()
    assert key == f"{body.id}.png"
    assert data == image_bytes()
    assert content_type == "image/png"

    with Session(image_env.engine) as session:
        [row] = session.scalars(select(ChatImage)).all()
        assert row.id == body.id
        assert row.status == "ready"
        assert row.owner_user_id == USER_ID
        assert row.conversation_id is None
        assert row.expires_at is not None


def test_upload_rejects_oversized_images(test_client, image_env, enable_vision):
    image_env.apply_settings(max_upload_bytes=len(image_bytes()) - 1)

    response = test_client.post(
        "/v1/images",
        data={"model": VISION_MODEL},
        files={"file": ("shot.png", image_bytes(), "image/png")},
    )

    assert response.status_code == 413
    with Session(image_env.engine) as session:
        assert session.scalars(select(ChatImage)).all() == []
    assert image_env.store.objects == {}


def test_upload_rejects_unsupported_formats(test_client, image_env, enable_vision):
    image_env.apply_settings()

    response = test_client.post(
        "/v1/images",
        data={"model": VISION_MODEL},
        files={"file": ("animation.gif", image_bytes("GIF"), "image/gif")},
    )

    assert response.status_code == 415
    with Session(image_env.engine) as session:
        assert session.scalars(select(ChatImage)).all() == []


def test_metadata_is_owner_scoped(test_client, image_env, override_authenticate_user):
    image_env.apply_settings()
    image_id = "11111111-1111-4111-8111-111111111111"
    seed_row(image_env.engine, image_id)

    response = test_client.get(f"/v1/images/{image_id}/metadata")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == image_id
    assert body["managed_url"] == f"mucgpt-image://{image_id}"
    assert "bucket" not in body and "object_key" not in body
    assert "sha256" not in body

    restore = switch_user(OTHER_USER_ID, override_authenticate_user)
    try:
        response = test_client.get(f"/v1/images/{image_id}/metadata")
        assert response.status_code == 404
    finally:
        restore()


def test_metadata_hides_expired_and_malformed_ids(test_client, image_env):
    image_env.apply_settings()
    expired_id = "22222222-2222-4222-8222-222222222222"
    with Session(image_env.engine) as session, session.begin():
        session.add(
            ChatImage(
                id=expired_id,
                owner_user_id=USER_ID,
                bucket="test-bucket",
                object_key=f"{expired_id}.png",
                mime_type="image/png",
                size_bytes=1,
                sha256="a" * 64,
                original_filename="old.png",
                status="ready",
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )

    for path in [f"/v1/images/{expired_id}/metadata", "/v1/images/nope/metadata"]:
        response = test_client.get(path)
        assert response.status_code == 404


def test_content_streams_with_safe_headers(test_client, image_env):
    image_env.apply_settings()
    image_id = "33333333-3333-4333-8333-333333333333"
    seed_row(image_env.engine, image_id)
    image_env.store.objects[f"{image_id}.png"] = (image_bytes(), "image/png")

    response = test_client.get(f"/v1/images/{image_id}/content")

    assert response.status_code == 200
    assert response.content == image_bytes()
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_content_is_owner_scoped(test_client, image_env, override_authenticate_user):
    image_env.apply_settings()
    image_id = "33333333-3333-4333-8333-333333333333"
    seed_row(image_env.engine, image_id)
    image_env.store.objects[f"{image_id}.png"] = (image_bytes(), "image/png")

    restore = switch_user(OTHER_USER_ID, override_authenticate_user)
    try:
        response = test_client.get(f"/v1/images/{image_id}/content")
        assert response.status_code == 404
    finally:
        restore()


def test_delete_removes_unbound_drafts(test_client, image_env):
    image_env.apply_settings()
    image_id = "44444444-4444-4444-8444-444444444444"
    seed_row(image_env.engine, image_id)
    image_env.store.objects[f"{image_id}.png"] = (image_bytes(), "image/png")

    response = test_client.delete(f"/v1/images/{image_id}")

    assert response.status_code == 204
    with Session(image_env.engine) as session:
        assert session.get(ChatImage, image_id) is None
        pending = session.scalars(select(ImageDeletionOutbox)).all()
        assert [(entry.bucket, entry.object_key) for entry in pending] == [
            ("test-bucket", f"{image_id}.png")
        ]
        assert pending[0].reason == "draft_delete"


def test_delete_rejects_bound_and_foreign_images(
    test_client, image_env, override_authenticate_user
):
    image_env.apply_settings()
    bound_id = "55555555-5555-4555-8555-555555555555"
    seed_row(image_env.engine, bound_id, bound=True)

    response = test_client.delete(f"/v1/images/{bound_id}")
    assert response.status_code == 409

    restore = switch_user(OTHER_USER_ID, override_authenticate_user)
    try:
        response = test_client.delete(f"/v1/images/{bound_id}")
        assert response.status_code == 404
    finally:
        restore()


def test_delete_survives_storage_unavailability(test_client, image_env):
    """The request is transactional: storage trouble defers object removal
    to the outbox instead of failing or leaving an orphan row behind."""
    image_env.apply_settings()
    image_id = "66666666-6666-4666-8666-666666666666"
    seed_row(image_env.engine, image_id)
    image_env.store.objects[f"{image_id}.png"] = (image_bytes(), "image/png")
    image_env.store.fail_delete = True

    response = test_client.delete(f"/v1/images/{image_id}")

    assert response.status_code == 204
    with Session(image_env.engine) as session:
        assert session.get(ChatImage, image_id) is None
        assert session.scalars(select(ImageDeletionOutbox)).all()
