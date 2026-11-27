from collections.abc import AsyncGenerator, Iterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, patch

import anyio
import cloudpickle
import httpx2
import pytest
from langchain_core.tools import StructuredTool
from mcp.types import Tool as MCPTool
from pydantic import ValidationError

from agent.tools.mcp import McpBearerAuthProvider, McpLoader, _decline_elicitation
from config.settings import MCPConfig, MCPSourceConfig, MCPTransport
from core.auth_models import AuthenticationResult

SECRET_HEADER_VALUE = "supersecretheadervalue123"
SECRET_OVERRIDE_VALUE = "supersecretoverridevalue456"
FORWARDED_TOKEN_VALUE = "supersecretforwardedtoken789"


def make_source(
    url: str,
    transport: MCPTransport = MCPTransport.SSE,
    forward_token: bool = False,
    forward_auth_override: str | None = None,
    headers: dict[str, str] | None = None,
    **kwargs: Any,
) -> MCPSourceConfig:
    return MCPSourceConfig(
        url=url,
        transport=transport,
        forward_token=forward_token,
        forward_auth_override=forward_auth_override,
        headers=headers,
        **kwargs,
    )


def make_user(uid: str = "u1", token: str = "user-jwt-token") -> AuthenticationResult:
    return AuthenticationResult(
        token=token,
        user_id=uid,
        department="IT",
        name="Test User",
        roles=["mucgpt-user"],
    )


def make_tool(
    name: str = "search_docs", description: str = "Search documents"
) -> StructuredTool:
    return StructuredTool(
        name=name,
        description=description,
        args_schema={"type": "object", "properties": {"query": {"type": "string"}}},
        coroutine=AsyncMock(),
    )


class FakeClient:
    async def __aenter__(self) -> "FakeClient":
        return self

    async def __aexit__(self, *_args: Any) -> None:
        return None


class FakeAdapter:
    def __init__(self, _client: FakeClient, tools: list[StructuredTool]) -> None:
        self.tools = tools

    async def __aenter__(self) -> "FakeAdapter":
        return self

    async def __aexit__(self, *_args: Any) -> None:
        return None

    async def list_tools(self) -> list[StructuredTool]:
        return self.tools


class FakeLock:
    def __init__(self, raise_on_enter: Exception | None = None) -> None:
        self._raise_on_enter = raise_on_enter

    async def __aenter__(self) -> "FakeLock":
        if self._raise_on_enter:
            raise self._raise_on_enter
        return self

    async def __aexit__(self, *_args: Any) -> bool:
        return False


class FakeRedis:
    def __init__(self, raise_on_enter: Exception | None = None) -> None:
        self._raise_on_enter = raise_on_enter

    def lock(self, name: str, timeout: int, blocking_timeout: int) -> FakeLock:
        return FakeLock(self._raise_on_enter)


@asynccontextmanager
async def fake_adapter(tools: list[StructuredTool]) -> AsyncGenerator[FakeAdapter]:
    yield FakeAdapter(FakeClient(), tools)


@pytest.fixture(autouse=True)
def reset_token_store() -> Iterator[None]:
    McpBearerAuthProvider._tokens.clear()
    yield
    McpBearerAuthProvider._tokens.clear()


@pytest.fixture(autouse=True)
def fake_tool_wrapper(monkeypatch: pytest.MonkeyPatch) -> None:
    async def wrap(raw_tool: MCPTool, _client: Any) -> StructuredTool:
        return make_tool(raw_tool.name)

    monkeypatch.setattr("agent.tools.mcp.as_langchain_tool", wrap)


class TestBuildConnection:
    def test_sse_with_static_headers_and_forwarded_token(self) -> None:
        client = McpLoader._build_connection(
            "src",
            make_source(
                "http://mcp.example/sse",
                forward_token=True,
                headers={"X-Api-Key": SECRET_HEADER_VALUE},
            ),
            make_user(),
        )

        assert client is not None
        assert client.transport.headers == {"X-Api-Key": SECRET_HEADER_VALUE}
        assert isinstance(client.transport.auth, McpBearerAuthProvider)
        assert client._elicitation_callback is not None

    @pytest.mark.asyncio
    async def test_forwarded_auth_is_accepted_when_transport_opens(self) -> None:
        captured: dict[str, Any] = {}

        @asynccontextmanager
        async def fake_sse_client(*_args: Any, auth: Any = None, **_kwargs: Any):
            captured["auth"] = auth
            send, receive = anyio.create_memory_object_stream(1)
            try:
                yield receive, send
            finally:
                await send.aclose()
                await receive.aclose()

        client = McpLoader._build_connection(
            "src",
            make_source("http://mcp.example/sse", forward_token=True),
            make_user(),
        )
        assert client is not None
        client.auto_initialize = False

        with patch("fastmcp.client.transports.sse.sse_client", fake_sse_client):
            async with client:
                pass

        assert isinstance(captured["auth"], httpx2.Auth)

    @pytest.mark.asyncio
    async def test_elicitation_is_declined_until_chat_ui_supports_it(self) -> None:
        result = await _decline_elicitation()
        assert result.action == "decline"

    def test_authorization_header_key_is_dropped(self) -> None:
        client = McpLoader._build_connection(
            "src",
            make_source("http://mcp.example/sse", headers={"Authorization": "ignored"}),
            make_user(),
        )

        assert client is not None
        assert client.transport.headers == {}
        assert client.transport.auth is None

    def test_streamable_http_uses_fastmcp_transport(self) -> None:
        client = McpLoader._build_connection(
            "src",
            make_source(
                "http://mcp.example/mcp", transport=MCPTransport.STREAMABLE_HTTP
            ),
            make_user(),
        )

        assert client is not None
        assert client.transport.__class__.__name__ == "StreamableHttpTransport"

    def test_unsupported_transport_returns_none(self) -> None:
        source = make_source("http://mcp.example/sse")
        object.__setattr__(source, "transport", "stdio")
        assert McpLoader._build_connection("src", source, make_user()) is None


class TestApplyToolCustomizations:
    def test_unconfigured_mcp_source_leaves_limit_for_shared_default(self) -> None:
        source = MCPSourceConfig(url="http://x", transport=MCPTransport.SSE)
        tool = StructuredTool(
            name="search_docs",
            description="Search documents",
            args_schema={"type": "object", "properties": {}},
            coroutine=AsyncMock(),
            metadata={"run_limit": 999},
        )

        McpLoader._apply_tool_customizations(tool, "src", source)

        assert tool.metadata is not None
        assert "run_limit" not in tool.metadata

    @pytest.mark.parametrize(
        "override, expected",
        [
            (None, 4),
            ({"name": "search_docs"}, 4),
            ({"name": "search_docs", "run_limit": 2}, 2),
            ({"name": "search_docs", "run_limit": None}, None),
            ({"name": "old_name", "run_limit": 2}, 4),
        ],
    )
    def test_run_limit_inheritance(
        self, override: dict[str, Any] | None, expected: int | None
    ) -> None:
        source = MCPSourceConfig(
            url="http://x",
            transport=MCPTransport.SSE,
            run_limit=4,
            overrides=[override] if override else None,
        )
        tool = StructuredTool(
            name="search_docs",
            description="Search documents",
            args_schema={"type": "object", "properties": {}},
            coroutine=AsyncMock(),
            metadata={"run_limit": 999},
        )

        McpLoader._apply_tool_customizations(tool, "src", source)

        assert tool.metadata is not None
        assert tool.metadata["run_limit"] == expected

    @pytest.mark.parametrize("limit", [0, -1])
    @pytest.mark.parametrize("on_override", [False, True])
    def test_rejects_non_positive_run_limits(
        self, limit: int, on_override: bool
    ) -> None:
        with pytest.raises(ValidationError):
            if on_override:
                MCPSourceConfig(
                    url="http://x",
                    transport=MCPTransport.SSE,
                    overrides=[{"name": "search_docs", "run_limit": limit}],
                )
            else:
                MCPSourceConfig(
                    url="http://x", transport=MCPTransport.SSE, run_limit=limit
                )

    def test_override_applies_description_and_group(self) -> None:
        source = make_source(
            "http://x",
            group="default-group",
            overrides=[
                {
                    "name": "search_docs",
                    "description": "Custom enriched description",
                    "group": "search-group",
                }
            ],
        )
        tool = make_tool()
        tool.metadata = {"mcp": {"server_name": "upstream"}}

        McpLoader._apply_tool_customizations(tool, "src", source)

        assert tool.description == "Custom enriched description"
        assert tool.metadata["mcp"] == {"server_name": "upstream"}
        assert tool.metadata["mcp_group"] == "search-group"
        assert tool.metadata["mcp_source"] == "src"


class TestWrapRawTools:
    @pytest.mark.asyncio
    async def test_wraps_cached_metadata_with_live_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        source = make_source("http://mcp.example/sse", forward_token=True)
        raw = {"src": [MCPTool(name="search_docs", input_schema={"type": "object"})]}
        monkeypatch.setattr(McpLoader, "_build_connection", lambda *_args: FakeClient())

        async def wrap(raw_tool: MCPTool, _client: FakeClient) -> StructuredTool:
            return make_tool(raw_tool.name)

        monkeypatch.setattr("agent.tools.mcp.as_langchain_tool", wrap)
        tools = await McpLoader._wrap_raw_tools(raw, make_user(), {"src": source})

        assert len(tools) == 1
        assert tools[0].metadata is not None
        assert tools[0].metadata["mcp_source"] == "src"

    @pytest.mark.asyncio
    async def test_skips_source_no_longer_configured(self) -> None:
        raw = {"stale_source": [MCPTool(name="a", input_schema={"type": "object"})]}
        assert await McpLoader._wrap_raw_tools(raw, make_user(), {}) == []

    @pytest.mark.asyncio
    async def test_continues_wrapping_when_one_source_cannot_open(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        raw = {
            "bad": [MCPTool(name="bad_tool", input_schema={"type": "object"})],
            "good": [MCPTool(name="good_tool", input_schema={"type": "object"})],
        }
        sources = {
            "bad": make_source("http://bad/sse"),
            "good": make_source("http://good/sse"),
        }

        def build(source_id: str, *_args: Any) -> FakeClient:
            if source_id == "bad":
                raise RuntimeError("connection failed")
            return FakeClient()

        monkeypatch.setattr(McpLoader, "_build_connection", build)

        tools = await McpLoader._wrap_raw_tools(raw, make_user(), sources)

        assert [tool.name for tool in tools] == ["good_tool"]


class TestLoadMcpTools:
    @pytest.mark.asyncio
    async def test_no_secret_material_is_cached(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        source = make_source(
            "http://mcp.example/sse",
            forward_token=True,
            forward_auth_override=SECRET_OVERRIDE_VALUE,
            headers={"X-Api-Key": SECRET_HEADER_VALUE},
        )
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(sources={"src": source}, cache_ttl=100),
        )
        monkeypatch.setattr(McpLoader, "_build_connection", lambda *_args: FakeClient())
        monkeypatch.setattr(
            "agent.tools.mcp.MCPAdapter", lambda _client: fake_adapter([make_tool("a")])
        )
        monkeypatch.setattr(
            "agent.tools.mcp.RedisCache.get_redis", AsyncMock(return_value=FakeRedis())
        )
        with patch("agent.tools.mcp.RedisCache.set_object", AsyncMock()) as set_object:
            await McpLoader.load_mcp_tools(
                make_user(token=FORWARDED_TOKEN_VALUE), force_reload=True
            )

        cached = set_object.call_args.kwargs["obj"]
        dumped = cloudpickle.dumps(cached)
        assert SECRET_HEADER_VALUE.encode() not in dumped
        assert SECRET_OVERRIDE_VALUE.encode() not in dumped
        assert FORWARDED_TOKEN_VALUE.encode() not in dumped

    @pytest.mark.asyncio
    async def test_partial_failure_uses_short_ttl(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        good = make_source("http://good/sse")
        bad = make_source("http://bad/sse")
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(sources={"good": good, "bad": bad}, cache_ttl=100),
        )

        def build(source_id: str, *_args: Any) -> FakeClient:
            if source_id == "bad":
                raise RuntimeError("failed")
            return FakeClient()

        monkeypatch.setattr(McpLoader, "_build_connection", build)
        monkeypatch.setattr(
            "agent.tools.mcp.MCPAdapter", lambda _client: fake_adapter([make_tool("a")])
        )
        monkeypatch.setattr(
            "agent.tools.mcp.RedisCache.get_redis", AsyncMock(return_value=FakeRedis())
        )
        with patch("agent.tools.mcp.RedisCache.set_object", AsyncMock()) as set_object:
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=True)

        assert len(tools) == 1
        assert set_object.call_args.kwargs["ttl"] == 60
        assert list(set_object.call_args.kwargs["obj"]) == ["good"]

    @pytest.mark.asyncio
    async def test_all_sources_fail_without_caching(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        source = make_source("http://bad/sse")
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(sources={"bad": source}, cache_ttl=100),
        )
        monkeypatch.setattr(
            McpLoader,
            "_build_connection",
            lambda *_args: (_ for _ in ()).throw(RuntimeError("failed")),
        )
        monkeypatch.setattr(
            "agent.tools.mcp.RedisCache.get_redis", AsyncMock(return_value=FakeRedis())
        )
        with patch("agent.tools.mcp.RedisCache.set_object", AsyncMock()) as set_object:
            assert await McpLoader.load_mcp_tools(make_user(), force_reload=True) == []
        set_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_hit_rebuilds_live_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        source = make_source("http://mcp.example/sse", forward_token=True)
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(sources={"src": source}, cache_ttl=100),
        )
        cached = {"src": [MCPTool(name="a", input_schema={"type": "object"})]}
        build = patch.object(McpLoader, "_build_connection", return_value=FakeClient())
        with (
            build as build_connection,
            patch(
                "agent.tools.mcp.RedisCache.get_object", AsyncMock(return_value=cached)
            ),
        ):
            tools = await McpLoader.load_mcp_tools(make_user())

        assert len(tools) == 1
        build_connection.assert_called_once()
