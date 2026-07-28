from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from unittest.mock import AsyncMock, patch

import cloudpickle
import pytest
from mcp.types import ListToolsResult
from mcp.types import Tool as MCPTool

from agent.tools.mcp import McpBearerAuthProvider, McpLoader
from config.settings import MCPConfig, MCPSourceConfig, MCPTransport
from core.auth_models import AuthenticationResult

SECRET_HEADER_VALUE = "supersecretheadervalue123"
SECRET_OVERRIDE_VALUE = "supersecretoverridevalue456"
FORWARDED_TOKEN_VALUE = "supersecretforwardedtoken789"


class FakeSession:
    def __init__(self, pages: list[list[MCPTool]]) -> None:
        self._pages = pages

    async def initialize(self) -> None:
        return None

    async def list_tools(self, cursor: str | None = None) -> ListToolsResult:
        index = int(cursor) if cursor else 0
        page = self._pages[index]
        next_cursor = str(index + 1) if index + 1 < len(self._pages) else None
        return ListToolsResult(tools=page, nextCursor=next_cursor)


class FakeLock:
    def __init__(self, raise_on_enter: Exception | None = None) -> None:
        self._raise_on_enter = raise_on_enter

    async def __aenter__(self) -> "FakeLock":
        if self._raise_on_enter:
            raise self._raise_on_enter
        return self

    async def __aexit__(self, *args) -> bool:
        return False


class FakeRedis:
    def __init__(self, raise_on_enter: Exception | None = None) -> None:
        self._raise_on_enter = raise_on_enter

    def lock(self, name: str, timeout: int, blocking_timeout: int) -> FakeLock:
        return FakeLock(self._raise_on_enter)


def make_fake_create_session(
    sessions_by_url: dict[str, FakeSession], fail_urls: frozenset[str] = frozenset()
) -> Callable[..., AbstractAsyncContextManager[FakeSession]]:
    @asynccontextmanager
    async def _fake_create_session(
        connection, *, mcp_callbacks=None
    ) -> AsyncIterator[FakeSession]:
        url = connection["url"]
        if url in fail_urls:
            raise RuntimeError(f"simulated connection failure for {url}")
        yield sessions_by_url[url]

    return _fake_create_session


def make_source(
    url: str,
    forward_token: bool = False,
    forward_auth_override: str | None = None,
    headers: dict[str, str] | None = None,
) -> MCPSourceConfig:
    return MCPSourceConfig(
        url=url,
        transport=MCPTransport.SSE,
        forward_token=forward_token,
        forward_auth_override=forward_auth_override,
        headers=headers,
    )


def make_user(uid: str = "u1", token: str = "user-jwt-token") -> AuthenticationResult:
    return AuthenticationResult(
        token=token, user_id=uid, department="IT", name="Test User", roles=["mucgpt-user"]
    )


@pytest.fixture(autouse=True)
def reset_token_store() -> Iterator[None]:
    McpBearerAuthProvider._tokens.clear()
    yield
    McpBearerAuthProvider._tokens.clear()


class TestBuildConnection:
    def test_sse_with_static_headers_and_forwarded_token(self):
        source_cfg = make_source(
            "http://mcp.example/sse",
            forward_token=True,
            headers={"X-Api-Key": SECRET_HEADER_VALUE},
        )
        user_info = make_user()

        con = McpLoader._build_connection("src", source_cfg, user_info)

        assert con is not None
        assert con["headers"] == {"X-Api-Key": SECRET_HEADER_VALUE}
        assert isinstance(con["auth"], McpBearerAuthProvider)

    def test_authorization_header_key_is_dropped(self):
        source_cfg = make_source(
            "http://mcp.example/sse", headers={"Authorization": "should-be-ignored"}
        )

        con = McpLoader._build_connection("src", source_cfg, make_user())

        assert con["headers"] == {}

    def test_no_forward_token_means_no_auth_key(self):
        source_cfg = make_source("http://mcp.example/sse", forward_token=False)

        con = McpLoader._build_connection("src", source_cfg, make_user())

        assert "auth" not in con

    def test_unsupported_transport_returns_none(self):
        source_cfg = make_source("http://mcp.example/sse")
        object.__setattr__(source_cfg, "transport", "stdio")

        con = McpLoader._build_connection("src", source_cfg, make_user())

        assert con is None


class TestApplyToolCustomizations:
    def test_custom_description_overrides_and_group_is_resolved(self):
        from langchain_core.tools import StructuredTool

        source_cfg = MCPSourceConfig(
            url="http://x",
            transport=MCPTransport.SSE,
            group="default-group",
            tool_groups={"search_": "search-group"},
            descriptions=[
                {"name": "search_docs", "description": "Custom enriched description"}
            ],
        )
        tool = StructuredTool(
            name="search_docs",
            description="original description",
            args_schema={"type": "object", "properties": {}},
            coroutine=AsyncMock(),
        )

        McpLoader._apply_tool_customizations(tool, "src", source_cfg)

        assert tool.description == "Custom enriched description"
        assert tool.metadata["description"] == "Custom enriched description"
        assert tool.metadata["mcp_group"] == "search-group"
        assert tool.metadata["mcp_source"] == "src"


class TestWrapRawTools:
    def test_skips_source_no_longer_configured(self):
        raw_by_source = {"stale_source": [MCPTool(name="a", inputSchema={"type": "object"})]}

        tools = McpLoader._wrap_raw_tools(raw_by_source, make_user(), sources={})

        assert tools == []

    def test_produces_invocable_tool_with_live_auth(self):
        sources = {
            "src": make_source(
                "http://mcp.example/sse", forward_token=True, headers={"X-Api-Key": "h1"}
            )
        }
        raw_by_source = {"src": [MCPTool(name="a", inputSchema={"type": "object"})]}

        tools = McpLoader._wrap_raw_tools(raw_by_source, make_user(uid="u1"), sources)

        assert len(tools) == 1
        assert tools[0].name == "a"
        assert tools[0].metadata["mcp_source"] == "src"


class TestListAllToolsForSession:
    @pytest.mark.asyncio
    async def test_follows_pagination(self):
        page1 = [MCPTool(name="a", inputSchema={"type": "object"})]
        page2 = [MCPTool(name="b", inputSchema={"type": "object"})]
        session = FakeSession(pages=[page1, page2])

        tools = await McpLoader._list_all_tools_for_session(session)

        assert [t.name for t in tools] == ["a", "b"]


class TestLoadMcpTools:
    @pytest.mark.asyncio
    async def test_no_secret_material_is_ever_cached(self, monkeypatch):
        source_cfg = make_source(
            "http://mcp.example/sse",
            forward_token=True,
            forward_auth_override=SECRET_OVERRIDE_VALUE,
            headers={"X-Api-Key": SECRET_HEADER_VALUE},
        )
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={"src": source_cfg}, CACHE_TTL=100),
        )

        fake_session = FakeSession(
            pages=[[MCPTool(name="a", inputSchema={"type": "object"})]]
        )
        fake_create_session = make_fake_create_session({"http://mcp.example/sse": fake_session})

        with (
            patch("agent.tools.mcp.create_session", fake_create_session),
            patch(
                "agent.tools.mcp.RedisCache.get_redis",
                AsyncMock(return_value=FakeRedis()),
            ),
            patch(
                "agent.tools.mcp.RedisCache.set_object", AsyncMock()
            ) as mock_set_object,
        ):
            tools = await McpLoader.load_mcp_tools(
                make_user(token=FORWARDED_TOKEN_VALUE), force_reload=True
            )

        assert len(tools) == 1
        mock_set_object.assert_called_once()
        cached_obj = mock_set_object.call_args.kwargs["obj"]

        assert isinstance(cached_obj, dict)
        assert isinstance(cached_obj["src"][0], MCPTool)

        dumped = cloudpickle.dumps(cached_obj)
        assert SECRET_HEADER_VALUE.encode() not in dumped
        assert SECRET_OVERRIDE_VALUE.encode() not in dumped
        # The forwarded user bearer token is a secret too, not just static config
        # headers/overrides - make sure it's just as absent from what gets cached.
        assert FORWARDED_TOKEN_VALUE.encode() not in dumped

    @pytest.mark.asyncio
    async def test_partial_failure_caches_only_successful_sources_short_ttl(
        self, monkeypatch
    ):
        good = make_source("http://good/sse")
        bad = make_source("http://bad/sse")
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={"good": good, "bad": bad}, CACHE_TTL=100),
        )

        fake_session = FakeSession(
            pages=[[MCPTool(name="a", inputSchema={"type": "object"})]]
        )
        fake_create_session = make_fake_create_session(
            {"http://good/sse": fake_session}, fail_urls=frozenset({"http://bad/sse"})
        )

        with (
            patch("agent.tools.mcp.create_session", fake_create_session),
            patch(
                "agent.tools.mcp.RedisCache.get_redis",
                AsyncMock(return_value=FakeRedis()),
            ),
            patch(
                "agent.tools.mcp.RedisCache.set_object", AsyncMock()
            ) as mock_set_object,
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=True)

        assert len(tools) == 1
        assert tools[0].metadata["mcp_source"] == "good"
        mock_set_object.assert_called_once()
        assert mock_set_object.call_args.kwargs["ttl"] == 60
        cached_obj = mock_set_object.call_args.kwargs["obj"]
        assert list(cached_obj.keys()) == ["good"]

    @pytest.mark.asyncio
    async def test_all_sources_fail_returns_empty_without_caching(self, monkeypatch):
        bad = make_source("http://bad/sse")
        monkeypatch.setattr(
            McpLoader, "_mcp_settings", MCPConfig(SOURCES={"bad": bad}, CACHE_TTL=100)
        )
        fake_create_session = make_fake_create_session(
            {}, fail_urls=frozenset({"http://bad/sse"})
        )

        with (
            patch("agent.tools.mcp.create_session", fake_create_session),
            patch(
                "agent.tools.mcp.RedisCache.get_redis",
                AsyncMock(return_value=FakeRedis()),
            ),
            patch(
                "agent.tools.mcp.RedisCache.set_object", AsyncMock()
            ) as mock_set_object,
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=True)

        assert tools == []
        mock_set_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_unsupported_transport_source_counts_as_failed_not_cached(
        self, monkeypatch
    ):
        """A source with an unsupported transport must not be treated as a healthy
        empty result. Otherwise an all-unsupported config would cache [] with the
        full TTL instead of the short-TTL failure path used for real failures."""
        unsupported = make_source("http://unsupported/sse")
        object.__setattr__(unsupported, "transport", "stdio")
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={"unsupported": unsupported}, CACHE_TTL=100),
        )

        with (
            patch(
                "agent.tools.mcp.RedisCache.get_redis",
                AsyncMock(return_value=FakeRedis()),
            ),
            patch(
                "agent.tools.mcp.RedisCache.set_object", AsyncMock()
            ) as mock_set_object,
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=True)

        assert tools == []
        mock_set_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_hit_wraps_without_refetching(self, monkeypatch):
        source_cfg = make_source(
            "http://mcp.example/sse", forward_token=True, headers={"X-Api-Key": "live-secret"}
        )
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={"src": source_cfg}, CACHE_TTL=100),
        )
        cached_raw = {"src": [MCPTool(name="a", inputSchema={"type": "object"})]}

        create_session_mock = AsyncMock(side_effect=AssertionError("should not connect"))
        # Spy on the real _build_connection rather than stubbing it out, so we can
        # prove the live connection/auth is rebuilt fresh on this cache-hit path -
        # never reused or reconstructed from anything that came out of Redis.
        original_build_connection = McpLoader._build_connection

        with (
            patch("agent.tools.mcp.create_session", create_session_mock),
            patch(
                "agent.tools.mcp.RedisCache.get_object",
                AsyncMock(return_value=cached_raw),
            ),
            patch.object(
                McpLoader, "_build_connection", side_effect=original_build_connection
            ) as build_connection_spy,
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=False)

        create_session_mock.assert_not_called()
        build_connection_spy.assert_called_once()
        assert len(tools) == 1
        assert tools[0].name == "a"
        assert tools[0].metadata["mcp_source"] == "src"

    @pytest.mark.asyncio
    async def test_stale_cached_source_is_skipped_not_raised(self, monkeypatch):
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={}, CACHE_TTL=100),
        )
        cached_raw = {
            "removed_source": [MCPTool(name="a", inputSchema={"type": "object"})]
        }

        with patch(
            "agent.tools.mcp.RedisCache.get_object", AsyncMock(return_value=cached_raw)
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=False)

        assert tools == []

    @pytest.mark.asyncio
    async def test_lock_contention_falls_back_to_uncached_load(self, monkeypatch):
        source_cfg = make_source("http://mcp.example/sse")
        monkeypatch.setattr(
            McpLoader,
            "_mcp_settings",
            MCPConfig(SOURCES={"src": source_cfg}, CACHE_TTL=100),
        )
        fake_session = FakeSession(
            pages=[[MCPTool(name="a", inputSchema={"type": "object"})]]
        )
        fake_create_session = make_fake_create_session({"http://mcp.example/sse": fake_session})

        from redis.exceptions import LockError

        with (
            patch("agent.tools.mcp.create_session", fake_create_session),
            patch("agent.tools.mcp.asyncio.sleep", AsyncMock()),
            patch(
                "agent.tools.mcp.RedisCache.get_redis",
                AsyncMock(return_value=FakeRedis(raise_on_enter=LockError("locked"))),
            ),
            patch(
                "agent.tools.mcp.RedisCache.get_object", AsyncMock(return_value=None)
            ),
            patch("agent.tools.mcp.RedisCache.set_object", AsyncMock()),
        ):
            tools = await McpLoader.load_mcp_tools(make_user(), force_reload=False)

        assert len(tools) == 1
        assert tools[0].name == "a"
