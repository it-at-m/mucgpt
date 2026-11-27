"""Valkey-backed tests for the RedisCache object storage.

These run against a real disposable Valkey container (same image family as the
stack's valkey service), so cloudpickle payloads and TTL behavior are exercised
end-to-end instead of against mocks. Tests skip when no container runtime is
reachable or when MUCGPT_TEST_VALKEY=off.
"""

import asyncio
from collections.abc import Awaitable
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, cast
from unittest.mock import AsyncMock

import httpx2
import pytest
import pytest_asyncio
import redis.asyncio as redis_asyncio
from langchain_core.tools import StructuredTool
from tests import container_runtime

from agent.tools.mcp import McpBearerAuthProvider, McpLoader
from chat_migration import router as chat_migration_router
from config.settings import (
    MCPConfig,
    MCPSourceConfig,
    MCPTransport,
    RedisConfig,
    Settings,
)
from core.auth_models import AuthenticationResult
from core.cache import RedisCache

# Captured at import time, before the session-wide held_run_locks fixture
# replaces RedisCache.get_redis with a fake.
_REAL_GET_REDIS = RedisCache.get_redis

_container = None


@dataclass
class _FakeMcpClient:
    server_info: None = None


class _FakeMcpAdapter:
    def __init__(self, tools: list[StructuredTool]) -> None:
        self._tools = tools

    async def __aenter__(self) -> "_FakeMcpAdapter":
        return self

    async def __aexit__(self, *_args: Any) -> None:
        return None

    async def list_tools(self) -> list[StructuredTool]:
        return self._tools


def _mcp_tool(name: str) -> StructuredTool:
    return StructuredTool(
        name=name,
        description=f"Description for {name}",
        args_schema={"type": "object", "properties": {}},
        coroutine=AsyncMock(),
    )


def _mcp_user(user_id: str) -> AuthenticationResult:
    return AuthenticationResult(
        token="test-token",
        user_id=user_id,
        department="IT",
        name="Valkey Test User",
        roles=["mucgpt-user"],
    )


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


@pytest.mark.asyncio
async def test_mcp_loader_reuses_cached_metadata_from_real_valkey(
    valkey_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A second tool load uses Redis metadata rather than rediscovering MCP tools."""
    source = MCPSourceConfig(url="http://mcp.example/sse", transport=MCPTransport.SSE)
    monkeypatch.setattr(
        McpLoader,
        "_mcp_settings",
        MCPConfig(sources={"documents": source}, cache_ttl=60),
    )
    build_calls: list[_FakeMcpClient] = []

    def build_connection(*_args: Any) -> _FakeMcpClient:
        client = _FakeMcpClient()
        build_calls.append(client)
        return client

    async def wrap_tool(raw_tool, _client: _FakeMcpClient) -> StructuredTool:
        return _mcp_tool(raw_tool.name)

    monkeypatch.setattr(McpLoader, "_build_connection", build_connection)
    monkeypatch.setattr("agent.tools.mcp.as_langchain_tool", wrap_tool)
    monkeypatch.setattr(
        "agent.tools.mcp.MCPAdapter",
        lambda _client: _FakeMcpAdapter([_mcp_tool("search")]),
    )
    user = _mcp_user("valkey-cache-hit")

    first = await McpLoader.load_mcp_tools(user)
    cache_key = f"{McpLoader._CACHE_PREFIX}:{user.user_id}"
    cached = await RedisCache.get_object(cache_key)

    assert [tool.name for tool in first] == ["search"]
    assert cached is not None
    assert cached["documents"][0].tool.name == "search"
    # A cold load creates one client for discovery and one for the returned tool.
    assert len(build_calls) == 2

    monkeypatch.setattr(
        "agent.tools.mcp.MCPAdapter",
        lambda _client: (_ for _ in ()).throw(
            AssertionError("cache hit rediscovered MCP tools")
        ),
    )
    second = await McpLoader.load_mcp_tools(user)

    assert [tool.name for tool in second] == ["search"]
    assert len(build_calls) == 3  # A cache hit only creates the invocation client.


@pytest.mark.asyncio
async def test_mcp_loader_force_reload_replaces_real_valkey_cache(
    valkey_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """force_reload bypasses existing Redis metadata and stores fresh discovery results."""
    source = MCPSourceConfig(url="http://mcp.example/sse", transport=MCPTransport.SSE)
    monkeypatch.setattr(
        McpLoader,
        "_mcp_settings",
        MCPConfig(sources={"documents": source}, cache_ttl=60),
    )
    monkeypatch.setattr(McpLoader, "_build_connection", lambda *_args: _FakeMcpClient())

    async def wrap_tool(raw_tool, _client: _FakeMcpClient) -> StructuredTool:
        return _mcp_tool(raw_tool.name)

    monkeypatch.setattr("agent.tools.mcp.as_langchain_tool", wrap_tool)
    user = _mcp_user("valkey-force-reload")
    cache_key = f"{McpLoader._CACHE_PREFIX}:{user.user_id}"
    await RedisCache.set_object(
        cache_key,
        {"documents": []},
        ttl=60,
    )
    monkeypatch.setattr(
        "agent.tools.mcp.MCPAdapter",
        lambda _client: _FakeMcpAdapter([_mcp_tool("fresh")]),
    )

    tools = await McpLoader.load_mcp_tools(user, force_reload=True)
    cached = await RedisCache.get_object(cache_key)

    assert [tool.name for tool in tools] == ["fresh"]
    assert cached is not None
    assert [tool.tool.name for tool in cached["documents"]] == ["fresh"]


@pytest.mark.asyncio
async def test_mcp_loader_cache_hit_uses_current_forwarded_token(
    valkey_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cached metadata never retains a forwarded token after it is rotated."""
    source = MCPSourceConfig(
        url="http://mcp.example/sse",
        transport=MCPTransport.SSE,
        forward_token=True,
    )
    monkeypatch.setattr(
        McpLoader,
        "_mcp_settings",
        MCPConfig(sources={"documents": source}, cache_ttl=60),
    )
    monkeypatch.setattr(McpBearerAuthProvider, "_tokens", {})
    discovery_calls = 0
    invocation_clients: list[Any] = []

    def adapter_factory(_client: Any) -> _FakeMcpAdapter:
        nonlocal discovery_calls
        discovery_calls += 1
        return _FakeMcpAdapter([_mcp_tool("search")])

    async def wrap_tool(raw_tool: Any, client: Any) -> StructuredTool:
        invocation_clients.append(client)
        return _mcp_tool(raw_tool.name)

    monkeypatch.setattr("agent.tools.mcp.MCPAdapter", adapter_factory)
    monkeypatch.setattr("agent.tools.mcp.as_langchain_tool", wrap_tool)
    user_id = "valkey-forward-token"
    old_token = "old-token-must-not-be-cached"
    new_token = "new-token-after-rotation"
    cache_key = f"{McpLoader._CACHE_PREFIX}:{user_id}"

    await McpLoader.load_mcp_tools(
        _mcp_user(user_id).model_copy(update={"token": old_token})
    )
    cached_bytes = await valkey_client.get(cache_key)
    assert cached_bytes is not None
    assert old_token.encode() not in cached_bytes

    tools = await McpLoader.load_mcp_tools(
        _mcp_user(user_id).model_copy(update={"token": new_token})
    )
    auth = invocation_clients[-1].transport.auth
    request = httpx2.Request("GET", "https://mcp.example/tools")
    next(auth.auth_flow(request))

    assert [tool.name for tool in tools] == ["search"]
    assert discovery_calls == 1
    assert request.headers["Authorization"] == f"Bearer {new_token}"
