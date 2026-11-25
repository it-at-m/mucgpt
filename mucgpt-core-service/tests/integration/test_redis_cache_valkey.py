"""Valkey-backed tests for the RedisCache object storage.

These run against a real disposable Valkey container (same image family as the
stack's valkey service), so cloudpickle payloads and TTL behavior are exercised
end-to-end instead of against mocks. Tests skip when no container runtime is
reachable or when MUCGPT_TEST_VALKEY=off.
"""

import asyncio
from collections.abc import Awaitable
from contextlib import suppress
from typing import cast
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
import redis.asyncio as redis_asyncio
from tests import container_runtime

from chat_migration import router as chat_migration_router
from config.settings import RedisConfig, Settings
from core.cache import RedisCache

# Captured at import time, before the session-wide held_run_locks fixture
# replaces RedisCache.get_redis with a fake.
_REAL_GET_REDIS = RedisCache.get_redis

_container = None


@pytest.fixture(scope="module")
def valkey_container():
    """Start one Valkey container for this module; skip without a runtime."""
    global _container
    if _container is not None:
        yield _container
        return
    if __import__("os").getenv("MUCGPT_TEST_VALKEY", "auto").strip().lower() in {
        "off",
        "false",
        "0",
        "no",
    }:
        pytest.skip("Valkey testcontainer disabled via MUCGPT_TEST_VALKEY")
    try:
        container = container_runtime.start_valkey_container()
    except ModuleNotFoundError:
        pytest.skip("testcontainers[redis] extra not installed")
    if container is None:
        pytest.skip("no container runtime reachable for Valkey tests")
    _container = container
    yield container
    container.stop()
    _container = None


@pytest_asyncio.fixture
async def valkey_client(valkey_container):
    """A real redis-py async client plus RedisCache wired to it."""
    client = redis_asyncio.Redis(
        host=valkey_container.get_container_host_ip(),
        port=valkey_container.get_exposed_port(),
    )
    await cast(Awaitable[bool], client.ping())
    pytest.MonkeyPatch().setattr(
        RedisCache, "get_redis", staticmethod(AsyncMock(return_value=client))
    )
    yield client
    await client.aclose()
    RedisCache._redis_client = None


@pytest.mark.asyncio
async def test_object_roundtrip(valkey_client):
    payload = {"conversation": "conv-1", "documents": ["doc-1", "doc-2"], "count": 2}

    await RedisCache.set_object("mucgpt:test:obj", payload, ttl=60)

    assert await RedisCache.get_object("mucgpt:test:obj") == payload


@pytest.mark.asyncio
async def test_roundtrip_of_locally_defined_class(valkey_client):
    class TestCase:
        def __init__(self, name):
            self.name = name

    obj = TestCase("cloudpickle")
    await RedisCache.set_object("mucgpt:test:cls", obj, ttl=60)

    restored = await RedisCache.get_object("mucgpt:test:cls")
    assert isinstance(restored, TestCase)
    assert restored.name == "cloudpickle"


@pytest.mark.asyncio
async def test_missing_key_returns_none(valkey_client):
    assert await RedisCache.get_object("mucgpt:test:absent") is None


@pytest.mark.asyncio
async def test_ttl_expires_entry(valkey_client):
    await RedisCache.set_object("mucgpt:test:ttl", {"short": "lived"}, ttl=1)
    assert await RedisCache.get_object("mucgpt:test:ttl") == {"short": "lived"}

    await asyncio.sleep(1.3)

    assert await RedisCache.get_object("mucgpt:test:ttl") is None


@pytest.mark.asyncio
async def test_init_redis_with_real_valkey(valkey_container, monkeypatch):
    """init_redis connects to a reachable server and caches the client."""
    monkeypatch.setattr(
        RedisCache,
        "_redis_settings",
        RedisConfig(
            host=valkey_container.get_container_host_ip(),
            port=valkey_container.get_exposed_port(),
        ),
    )
    monkeypatch.setattr(RedisCache, "get_redis", staticmethod(_REAL_GET_REDIS))
    RedisCache._redis_client = None

    await RedisCache.init_redis()

    client = await RedisCache.get_redis()
    assert await cast(Awaitable[bool], client.ping()) is True

    RedisCache._redis_client = None


@pytest.mark.asyncio
async def test_chat_migration_slots_limit_concurrent_imports(
    valkey_client, monkeypatch
):
    """Real Valkey locks cap imports globally and admit a caller after release."""
    monkeypatch.setattr(
        chat_migration_router,
        "get_settings",
        lambda: Settings(
            chat_migration_max_concurrent_imports=2,
            chat_migration_slot_ttl_seconds=60,
        ),
    )

    slots = await asyncio.gather(
        *(chat_migration_router._acquire_import_slot() for _ in range(3))
    )
    acquired = [slot for slot in slots if slot is not None]
    assert len(acquired) == 2
    assert slots.count(None) == 1

    await chat_migration_router._release_import_slot(acquired.pop())
    replacement = await chat_migration_router._acquire_import_slot()
    assert replacement is not None
    acquired.append(replacement)

    await asyncio.gather(
        *(chat_migration_router._release_import_slot(slot) for slot in acquired)
    )


@pytest.mark.asyncio
async def test_chat_migration_slot_renewal_keeps_capacity_claimed(
    valkey_client, monkeypatch
):
    """A slow import continues to occupy its real Valkey capacity slot."""
    monkeypatch.setattr(
        chat_migration_router,
        "get_settings",
        lambda: Settings(
            chat_migration_max_concurrent_imports=1,
            chat_migration_slot_ttl_seconds=1,
        ),
    )
    slot = await chat_migration_router._acquire_import_slot()
    assert slot is not None
    stop = asyncio.Event()
    renewal = asyncio.create_task(
        chat_migration_router._renew_import_slot(slot, 1, stop)
    )
    try:
        await asyncio.sleep(1.1)
        assert await chat_migration_router._acquire_import_slot() is None
    finally:
        stop.set()
        renewal.cancel()
        with suppress(asyncio.CancelledError):
            await renewal
        await chat_migration_router._release_import_slot(slot)
