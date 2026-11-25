"""Valkey-backed tests for the RedisCache object storage.

These run against a real disposable Valkey container (same image family as the
stack's valkey service), so cloudpickle payloads and TTL behavior are exercised
end-to-end instead of against mocks. Tests skip when no container runtime is
reachable or when MUCGPT_TEST_VALKEY=off.
"""

import asyncio
from collections.abc import Awaitable
from typing import cast
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
import redis.asyncio as redis_asyncio
from tests import container_runtime

from config.settings import RedisConfig
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
