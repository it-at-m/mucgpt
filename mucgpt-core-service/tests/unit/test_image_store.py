"""S3 image store behavior with a fake boto3 module (no network access)."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import anyio
import pytest

from config.settings import ImageConfig, ImageStorageConfig
from core import image_store as store_module
from core.image_store import (
    ImageStorageError,
    ImageStorageManager,
    S3ImageStore,
)


class FakeBoto3:
    """Record client construction and expose one recording fake client."""

    def __init__(self):
        self.constructed = []
        self.last_client = MagicMock()

    def client(self, *args, **kwargs):
        self.constructed.append(SimpleNamespace(args=args, kwargs=kwargs))
        return self.last_client


def make_store(monkeypatch, *, bucket="mucgpt-images", prefix="chat-images/"):
    fake = FakeBoto3()
    monkeypatch.setattr(store_module, "boto3", fake)
    config = ImageStorageConfig(
        bucket=bucket,
        endpoint_url="http://localhost:9000",
        region="test-region",
        key_prefix=prefix,
        force_path_style=True,
        access_key_id="ak",
        secret_access_key="sk",
    )
    store = S3ImageStore(bucket=bucket, settings=config)
    return store, fake


def test_store_builds_client_with_explicit_settings(monkeypatch):
    _, fake = make_store(monkeypatch)

    [construction] = fake.constructed
    kwargs = construction.kwargs
    assert kwargs["endpoint_url"].rstrip("/") == "http://localhost:9000"
    assert kwargs["region_name"] == "test-region"
    assert kwargs["aws_access_key_id"] == "ak"
    assert kwargs["aws_secret_access_key"] == "sk"
    assert kwargs["config"].s3 == {"addressing_style": "path"}
    assert kwargs["config"].signature_version == "s3v4"


def test_object_keys_live_below_the_configured_prefix(monkeypatch):
    store, _ = make_store(monkeypatch, prefix="img/")

    assert store.full_key("abc.png") == "img/abc.png"
    assert store.full_key("/abc.png") == "img/abc.png"


def test_put_uploads_verified_content_type_without_public_acl(monkeypatch):
    store, fake = make_store(monkeypatch)

    anyio.run(store.put, "abc.png", b"data", "image/png")

    fake.last_client.put_object.assert_called_once_with(
        Bucket="mucgpt-images",
        Key="chat-images/abc.png",
        Body=b"data",
        ContentType="image/png",
    )


def test_put_wraps_provider_failures(monkeypatch):
    store, fake = make_store(monkeypatch)
    fake.last_client.put_object.side_effect = RuntimeError("network down")

    with pytest.raises(ImageStorageError):
        anyio.run(store.put, "abc.png", b"data", "image/png")


def test_get_returns_bounded_bytes(monkeypatch):
    store, fake = make_store(monkeypatch)
    fake.last_client.get_object.return_value = {
        "Body": SimpleNamespace(read=lambda size: b"image-bytes"[:size])
    }

    assert anyio.run(store.get, "abc.png", 100) == b"image-bytes"


def test_get_refuses_payloads_above_the_limit(monkeypatch):
    store, fake = make_store(monkeypatch)
    fake.last_client.get_object.return_value = {
        "Body": SimpleNamespace(read=lambda size: b"x" * size)
    }

    with pytest.raises(ImageStorageError, match="exceeds its size limit"):
        anyio.run(store.get, "abc.png", 10)


def test_delete_is_idempotent_towards_the_provider(monkeypatch):
    store, fake = make_store(monkeypatch)

    anyio.run(store.delete, "abc.png")

    fake.last_client.delete_object.assert_called_once_with(
        Bucket="mucgpt-images", Key="chat-images/abc.png"
    )


def test_manager_publishes_nothing_when_disabled():
    async def run():
        await ImageStorageManager.init(ImageConfig())
        try:
            with pytest.raises(RuntimeError, match="not initialized"):
                ImageStorageManager.get_store()
        finally:
            await ImageStorageManager.close()

    anyio.run(run)


def test_manager_verifies_bucket_access_when_enabled(monkeypatch):
    async def run():
        fake = FakeBoto3()
        monkeypatch.setattr(store_module, "boto3", fake)
        config = ImageConfig(
            enabled=True, s3=ImageStorageConfig(bucket="mucgpt-images")
        )

        await ImageStorageManager.init(config)
        assert ImageStorageManager.get_store() is not None
        fake.last_client.head_bucket.assert_called_once_with(Bucket="mucgpt-images")
        await ImageStorageManager.close()
        with pytest.raises(RuntimeError):
            ImageStorageManager.get_store()

    anyio.run(run)


def test_manager_fails_startup_when_the_bucket_is_unreachable(monkeypatch):
    async def run():
        fake = FakeBoto3()
        fake.last_client.head_bucket.side_effect = RuntimeError("no route to host")
        monkeypatch.setattr(store_module, "boto3", fake)
        config = ImageConfig(
            enabled=True, s3=ImageStorageConfig(bucket="mucgpt-images")
        )

        with pytest.raises(ImageStorageError, match="not accessible"):
            await ImageStorageManager.init(config)
        with pytest.raises(RuntimeError):
            ImageStorageManager.get_store()
        await ImageStorageManager.close()

    anyio.run(run)
