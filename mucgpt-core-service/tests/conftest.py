from unittest.mock import AsyncMock, Mock

import pytest

from config.langfuse_provider import LangfuseProvider


@pytest.fixture(autouse=True)
def disable_langfuse(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep test runs independent from Langfuse credentials and services."""

    monkeypatch.setattr(LangfuseProvider, "_langfuse_callback", None)
    monkeypatch.setattr(LangfuseProvider, "init", staticmethod(lambda **_kwargs: None))
    monkeypatch.setattr(
        LangfuseProvider, "get_callback_handler", staticmethod(lambda: None)
    )


class FakeLock:
    def __init__(self, held: set[str], name: str) -> None:
        self.held = held
        self.name = name

    async def acquire(self) -> bool:
        if self.name in self.held:
            return False
        self.held.add(self.name)
        return True

    async def release(self) -> None:
        self.held.remove(self.name)


@pytest.fixture(autouse=True)
def held_run_locks(monkeypatch: pytest.MonkeyPatch) -> set[str]:
    held: set[str] = set()
    redis = Mock(lock=lambda name, **_kwargs: FakeLock(held, name))
    monkeypatch.setattr(
        "core.cache.RedisCache.get_redis", AsyncMock(return_value=redis)
    )
    return held
