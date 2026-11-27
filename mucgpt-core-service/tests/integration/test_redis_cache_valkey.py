"""Valkey-backed tests for the RedisCache object storage.

These run against a real disposable Valkey container (same image family as the
stack's valkey service), so cloudpickle payloads and TTL behavior are exercised
end-to-end instead of against mocks. Tests skip when no container runtime is
reachable or when MUCGPT_TEST_VALKEY=off.
"""

import asyncio
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
import redis.asyncio as redis_asyncio
from langchain_core.tools import StructuredTool
from tests import container_runtime

from agent.tools.mcp import McpLoader
from config.settings import MCPConfig, MCPSourceConfig, MCPTransport, RedisConfig
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
