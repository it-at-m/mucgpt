"""Hydration of managed image references at the provider boundary."""

import base64
import io
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import HumanMessage
from PIL import Image

from config.settings import ImageConfig, ImageStorageConfig
from core import image_hydration as hydration
from core.auth_models import AuthenticationResult
from core.image_hydration import (
    ImageHydrator,
    build_image_hydrator,
    contains_managed_images,
    find_managed_image_url,
)
from core.image_store import ImageStorageManager
from database.database_models import Base, ChatImage
from database.image_catalog import ImageCatalogManager


def image_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4)).save(buffer, format="PNG")
    return buffer.getvalue()


IMAGE_ID = "11111111-1111-4111-8111-111111111111"
MANAGED_URL = f"mucgpt-image://{IMAGE_ID}"


class FakeImageStore:
    def __init__(self, data: bytes = image_bytes()):
        self.data = data
        self.gets: list[str] = []

    async def get(self, key: str, max_bytes: int) -> bytes:
        self.gets.append(key)
        return self.data


class ImageSessions:
    def __init__(self, engine):
        self.engine = engine

    @asynccontextmanager
    async def _use(self, begin: bool):
        from unittest.mock import MagicMock

        from sqlalchemy.orm import Session

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


def seed_image(engine, image_id, *, bound_to="conv-1", status="ready", expires_hours=24):

    from sqlalchemy.orm import Session

    with Session(engine) as session, session.begin():
        session.add(
            ChatImage(
                id=image_id,
                owner_user_id="user",
                bucket="test-bucket",
                object_key=f"{image_id}.png",
                mime_type="image/png",
                size_bytes=len(image_bytes()),
                sha256="a" * 64,
                original_filename="shot.png",
                status=status,
                conversation_id=bound_to,
                bound_at=datetime.now(UTC) if bound_to else None,
                expires_at=(
                    None
                    if bound_to
                    else datetime.now(UTC) + timedelta(hours=expires_hours)
                ),
            )
        )


@pytest.fixture
def hydrator_env(monkeypatch: pytest.MonkeyPatch):
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine, tables=[ChatImage.__table__])
    sessions = ImageSessions(engine)
    store = FakeImageStore()
    monkeypatch.setattr(ImageCatalogManager, "_session_factory", sessions)
    monkeypatch.setattr(ImageStorageManager, "_store", store)
    monkeypatch.setattr(
        hydration,
        "get_settings",
        lambda: MagicMock(
            image_input=ImageConfig(
                enabled=True, s3=ImageStorageConfig(bucket="test-bucket")
            )
        ),
    )

    def make(persist=True, conversation_id="conv-1"):
        return ImageHydrator(
            user_id="user",
            conversation_id=conversation_id,
            persist=persist,
            store=store,
            settings=ImageConfig(
                enabled=True, s3=ImageStorageConfig(bucket="test-bucket")
            ),
        )

    yield SimpleNamespaceLocal(make=make, store=store, engine=engine)
    engine.dispose()


class SimpleNamespaceLocal:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def managed_message():
    return HumanMessage(
        content=[
            {"type": "text", "text": "What does this form require?"},
            {"type": "image_url", "image_url": {"url": MANAGED_URL}},
        ]
    )


def test_find_managed_image_url_recognizes_both_block_shapes():
    raw = {"type": "image_url", "image_url": {"url": MANAGED_URL}}
    normalized = {"type": "image", "url": MANAGED_URL}
    assert find_managed_image_url(raw) == MANAGED_URL
    assert find_managed_image_url(normalized) == MANAGED_URL
    assert find_managed_image_url({"type": "text", "text": "hi"}) is None
    assert (
        find_managed_image_url(
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,x"}}
        )
        is None
    )
    assert find_managed_image_url(
        {"type": "image_url", "image_url": {"url": "https://example.com/x.png"}}
    ) is None


def test_contains_managed_images_scans_message_lists():
    assert contains_managed_images([managed_message()]) is True
    assert contains_managed_images([HumanMessage(content="plain text")]) is False
    normalized = HumanMessage(
        content=[{"type": "image", "url": MANAGED_URL}]
    )
    assert contains_managed_images([normalized]) is True


@pytest.mark.asyncio
async def test_hydration_builds_data_uri_and_leaves_originals_untouched(
    hydrator_env,
):
    hydrator = hydrator_env.make()
    seed_image(hydrator_env.engine, IMAGE_ID, bound_to="conv-1")
    message = managed_message()
    [text_block, image_block_original] = message.content

    [hydrated_message] = await hydrator.hydrate_messages([message])
    [hydrated_text, hydrated_image] = hydrated_message.content

    assert hydrated_text == text_block  # text part untouched
    assert hydrated_image["type"] == "image_url"
    payload = hydrated_image["image_url"]
    assert payload["url"].startswith("data:image/png;base64,")
    assert base64.b64decode(payload["url"].split(",", 1)[1]) == image_bytes()

    # Original message and its blocks are never mutated.
    assert message.content[1]["image_url"]["url"] == MANAGED_URL

    # The object is fetched once per run; repeats reuse the cache.
    [hydrated_message] = await hydrator.hydrate_messages([message])
    assert len(hydrator_env.store.gets) == 1


@pytest.mark.asyncio
async def test_hydration_enforces_conversation_binding(hydrator_env):
    hydrator = hydrator_env.make(persist=True, conversation_id="conv-1")
    seed_image(hydrator_env.engine, IMAGE_ID, bound_to="conv-1")
    [hydrated] = await hydrator.hydrate_messages([managed_message()])
    assert hydrated.content[1]["image_url"]["url"].startswith("data:")

    foreign = hydrator_env.make(persist=True, conversation_id="other")
    with pytest.raises(hydration.ImageHydrationError, match="conversation"):
        await foreign.hydrate_messages([managed_message()])

    stateless_ok = hydrator_env.make(persist=False, conversation_id=None)
    seed_image(hydrator_env.engine, "22222222-2222-4222-8222-222222222222", bound_to=None)
    stateless_message = HumanMessage(
        content=[
            {
                "type": "image_url",
                "image_url": {
                    "url": "mucgpt-image://22222222-2222-4222-8222-222222222222"
                },
            }
        ]
    )
    [hydrated] = await stateless_ok.hydrate_messages([stateless_message])
    assert hydrated.content[0]["image_url"]["url"].startswith("data:")

    stateless_bound = hydrator_env.make(persist=False, conversation_id=None)
    with pytest.raises(hydration.ImageHydrationError, match="Stateless"):
        await stateless_bound.hydrate_messages([managed_message()])


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["deleting", "uploading"])
async def test_hydration_rejects_unavailable_images(hydrator_env, status):
    seed_image(hydrator_env.engine, IMAGE_ID, status=status)
    hydrator = hydrator_env.make()

    with pytest.raises(hydration.ImageHydrationError, match="no longer available"):
        await hydrator.hydrate_messages([managed_message()])


@pytest.mark.asyncio
async def test_hydration_rejects_expired_drafts(hydrator_env):
    seed_image(
        hydrator_env.engine,
        IMAGE_ID,
        bound_to=None,
        expires_hours=-1,
    )
    hydrator = hydrator_env.make(persist=False, conversation_id=None)

    with pytest.raises(hydration.ImageHydrationError, match="expired"):
        await hydrator.hydrate_messages([managed_message()])


@pytest.mark.asyncio
async def test_hydration_rejects_unknown_images(hydrator_env):
    hydrator = hydrator_env.make()

    with pytest.raises(hydration.ImageHydrationError, match="no longer available"):
        await hydrator.hydrate_messages([managed_message()])


@pytest.mark.asyncio
async def test_hydration_enforces_total_byte_budget(hydrator_env):
    second_id = "33333333-3333-4333-8333-333333333333"
    seed_image(hydrator_env.engine, IMAGE_ID, bound_to="conv-1")
    seed_image(hydrator_env.engine, second_id, bound_to="conv-1")
    config = ImageConfig(
        enabled=True,
        max_upload_bytes=len(image_bytes()),
        # Budget covers exactly one image: the second must fail.
        max_hydration_bytes=len(image_bytes()),
        s3=ImageStorageConfig(bucket="test-bucket"),
    )
    hydrator = ImageHydrator(
        user_id="user",
        conversation_id="conv-1",
        persist=True,
        store=hydrator_env.store,
        settings=config,
    )
    two_images = HumanMessage(
        content=[
            {"type": "image_url", "image_url": {"url": MANAGED_URL}},
            {
                "type": "image_url",
                "image_url": {"url": f"mucgpt-image://{second_id}"},
            },
        ]
    )

    with pytest.raises(
        hydration.ImageHydrationError, match="too many images"
    ):
        await hydrator.hydrate_messages([two_images])


@pytest.mark.asyncio
async def test_hydration_rejects_foreign_buckets(hydrator_env):
    seed_image(hydrator_env.engine, IMAGE_ID, bound_to="conv-1")
    with __import__("sqlalchemy.orm", fromlist=["Session"]).Session(
        hydrator_env.engine
    ) as session, session.begin():
        row = session.get(ChatImage, IMAGE_ID)
        row.bucket = "some-other-bucket"

    hydrator = hydrator_env.make()
    with pytest.raises(hydration.ImageHydrationError, match="unknown storage"):
        await hydrator.hydrate_messages([managed_message()])


def test_build_image_hydrator_fails_closed_without_store(monkeypatch):
    monkeypatch.setattr(
        hydration,
        "get_settings",
        lambda: MagicMock(image_input=ImageConfig(enabled=False)),
    )
    user = AuthenticationResult(user_id="u", token="t", department="d")
    with pytest.raises(hydration.ImageHydrationError, match="not enabled"):
        build_image_hydrator(user, "conv", True)

    monkeypatch.setattr(
        hydration,
        "get_settings",
        lambda: MagicMock(
            image_input=ImageConfig(
                enabled=True, s3=ImageStorageConfig(bucket="b")
            )
        ),
    )
    monkeypatch.setattr(ImageStorageManager, "_store", None)
    with pytest.raises(hydration.ImageHydrationError, match="not available"):
        build_image_hydrator(user, "conv", True)
