"""Unit tests for the RedisCache wrapper (cloudpickle object storage).

The session-wide autouse `held_run_locks` fixture replaces RedisCache.get_redis
with a fake, so these tests capture the real implementation at import time and
restore it explicitly where they exercise it.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core import cache
from core.cache import RedisCache

# Captured at module import: fixtures have not patched the class yet.
_REAL_GET_REDIS = RedisCache.get_redis


@pytest.fixture(autouse=True)
def _reset_redis_client():
    RedisCache._redis_client = None
    yield
    RedisCache._redis_client = None


def _restore_real_get_redis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(RedisCache, "get_redis", staticmethod(_REAL_GET_REDIS))


class TestInitRedis:
    @pytest.mark.asyncio
    async def test_successful_ping_initializes_singleton(self):
        client = MagicMock(ping=AsyncMock())
        with patch.object(cache, "Redis", MagicMock(return_value=client)) as redis_cls:
            _restore_real_get_redis(pytest.MonkeyPatch())
            await RedisCache.init_redis()
            await RedisCache.init_redis()  # second call is a no-op

        redis_cls.assert_called_once()
        client.ping.assert_awaited_once()
        assert RedisCache._redis_client is client

    @pytest.mark.asyncio
    async def test_failed_ping_closes_client_and_raises(self):
        client = MagicMock(
            ping=AsyncMock(side_effect=ConnectionError("refused")),
            close=AsyncMock(),
        )
        with patch.object(cache, "Redis", MagicMock(return_value=client)):
            _restore_real_get_redis(pytest.MonkeyPatch())
            with pytest.raises(ConnectionError):
                await RedisCache.init_redis()

        client.close.assert_awaited_once()
        assert RedisCache._redis_client is None


class TestGetRedis:
    @pytest.mark.asyncio
    async def test_uninitialized_client_raises(self, monkeypatch):
        _restore_real_get_redis(monkeypatch)

        with pytest.raises(RuntimeError, match="not initialized"):
            await RedisCache.get_redis()

    @pytest.mark.asyncio
    async def test_initialized_client_is_returned(self, monkeypatch):
        _restore_real_get_redis(monkeypatch)
        client = MagicMock()
        RedisCache._redis_client = client

        assert await RedisCache.get_redis() is client


class TestObjectStorage:
    def _redis_with(self, **methods) -> MagicMock:
        monkeypatch = pytest.MonkeyPatch()
        redis = MagicMock(**methods)
        monkeypatch.setattr(
            RedisCache, "get_redis", staticmethod(AsyncMock(return_value=redis))
        )
        return redis

    @pytest.mark.asyncio
    async def test_set_object_pickles_and_sets_with_ttl(self):
        redis = self._redis_with(set=AsyncMock())

        await RedisCache.set_object("key", {"a": [1, 2]}, ttl=60)

        _, kwargs = redis.set.await_args
        assert kwargs["name"] == "key"
        assert kwargs["ex"] == 60
        import cloudpickle

        assert cloudpickle.loads(kwargs["value"]) == {"a": [1, 2]}

    @pytest.mark.asyncio
    async def test_set_object_without_ttl(self):
        redis = self._redis_with(set=AsyncMock())

        await RedisCache.set_object("key", "value")

        _, kwargs = redis.set.await_args
        assert kwargs["ex"] is None

    @pytest.mark.asyncio
    async def test_get_object_roundtrip(self):
        import cloudpickle

        payload = cloudpickle.dumps({"nested": {"value": 42}})
        self._redis_with(get=AsyncMock(return_value=payload))

        assert await RedisCache.get_object("key") == {"nested": {"value": 42}}

    @pytest.mark.asyncio
    async def test_get_object_missing_key_returns_none(self):
        self._redis_with(get=AsyncMock(return_value=None))

        assert await RedisCache.get_object("missing") is None
