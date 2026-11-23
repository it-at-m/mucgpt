from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from config.settings import RedisConfig
from core.cache import RedisCache


@pytest.fixture(autouse=True)
def reset_redis_cache() -> None:
    RedisCache._redis_client = None
    RedisCache._redis_settings = RedisConfig(
        host="redis.example", port=6380, username="cache-user"
    )


@pytest.mark.asyncio
async def test_init_redis_creates_and_reuses_healthy_client(monkeypatch) -> None:
    client = AsyncMock()
    redis_constructor = MagicMock(return_value=client)
    monkeypatch.setattr("core.cache.Redis", redis_constructor)

    await RedisCache.init_redis()
    await RedisCache.init_redis()

    redis_constructor.assert_called_once_with(
        host="redis.example", port=6380, username="cache-user", password=None
    )
    client.ping.assert_awaited_once()
    assert await RedisCache.get_redis() is client


@pytest.mark.asyncio
async def test_init_redis_closes_and_reraises_connection_failure(monkeypatch) -> None:
    client = AsyncMock()
    client.ping.side_effect = ConnectionError("unavailable")
    monkeypatch.setattr("core.cache.Redis", lambda **_kwargs: client)

    with pytest.raises(ConnectionError, match="unavailable"):
        await RedisCache.init_redis()

    client.close.assert_awaited_once()
    assert RedisCache._redis_client is None


@pytest.mark.asyncio
async def test_get_redis_requires_initialization() -> None:
    with pytest.raises(RuntimeError, match="not initialized"):
        await RedisCache.get_redis()


@pytest.mark.asyncio
async def test_set_and_get_object_round_trip() -> None:
    client = AsyncMock()
    RedisCache._redis_client = client
    value: dict[str, Any] = {"departments": ["DEPT"], "enabled": True}

    await RedisCache.set_object("directory", value, ttl=60)
    stored_value = client.set.await_args.kwargs["value"]
    client.get.return_value = stored_value

    assert await RedisCache.get_object("directory") == value
    client.set.assert_awaited_once_with(name="directory", value=stored_value, ex=60)
    client.get.assert_awaited_once_with(name="directory")


@pytest.mark.asyncio
async def test_get_object_returns_none_for_cache_miss() -> None:
    client = AsyncMock()
    client.get.return_value = None
    RedisCache._redis_client = client

    assert await RedisCache.get_object("missing") is None
