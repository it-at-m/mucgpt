"""Tests for agent tool schema selection and the ToolCollection assembly."""

from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.tools.base import BaseTool

from agent.state_models.default_state import DefaultAgentState
from agent.state_models.registry import registry
from agent.tools.spec import LocalTool
from agent.tools.tools import ToolCollection, select_agent_state_schema
from core.auth import AuthenticationResult


def _tool(name: str, metadata: object | None = None) -> BaseTool:
    tool = MagicMock()
    tool.name = name
    tool.metadata = metadata
    return cast(BaseTool, tool)


class TestSelectAgentStateSchema:
    @pytest.fixture
    def registered_schema(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> type[DefaultAgentState]:
        class TestAgentState(DefaultAgentState):
            pass

        monkeypatch.setitem(registry, "default", TestAgentState)
        return TestAgentState

    def test_no_tools_yields_default_schema(self) -> None:
        assert select_agent_state_schema([]) is DefaultAgentState

    def test_tools_without_metadata_yield_default_schema(self) -> None:
        assert (
            select_agent_state_schema([_tool("t1"), _tool("t2")]) is DefaultAgentState
        )

    def test_single_registered_group_yields_registry_schema(
        self, registered_schema: type[DefaultAgentState]
    ) -> None:
        """All tools in the registered 'default' group resolve to the registry entry."""
        tools = [
            _tool("t1", {"mcp_group": "default", "mcp_source": "src-a"}),
            _tool("t2", {"mcp_group": "default", "mcp_source": "src-b"}),
        ]

        assert select_agent_state_schema(tools) is registered_schema

    def test_single_unregistered_group_falls_back_to_default_schema(self) -> None:
        tools = [_tool("canvas_write", {"mcp_group": "Canvas", "mcp_source": None})]

        assert select_agent_state_schema(tools) is DefaultAgentState

    def test_mixed_groups_fall_back_to_default_schema(self) -> None:
        tools = [
            _tool("simplify", {"mcp_group": "default", "mcp_source": "local"}),
            _tool("canvas_write", {"mcp_group": "Canvas", "mcp_source": "local"}),
        ]

        assert select_agent_state_schema(tools) is DefaultAgentState

    def test_empty_mcp_group_treated_as_default(
        self, registered_schema: type[DefaultAgentState]
    ) -> None:
        """None/empty mcp_group falls back to the 'default' group, not a separate one."""
        tools = [
            _tool("t1", {"mcp_group": None, "mcp_source": "s1"}),
            _tool("t2", {"mcp_group": "", "mcp_source": "s2"}),
            _tool("t3", {"mcp_group": "default", "mcp_source": "s3"}),
        ]

        assert select_agent_state_schema(tools) is registered_schema

    def test_metadata_as_object_uses_getattr(
        self, registered_schema: type[DefaultAgentState]
    ) -> None:
        tool = MagicMock()
        tool.name = "t1"

        class Meta:
            mcp_group = "default"
            mcp_source = "src"

        tool.metadata = Meta()

        assert select_agent_state_schema([tool]) is registered_schema


class TestToolCollection:
    def _collection(self) -> ToolCollection:
        collection = ToolCollection(model=MagicMock())
        return collection

    def _local_tool(self, name: str, configured: bool = True) -> LocalTool:
        return LocalTool(
            id=name,
            factory=lambda *args: _tool(name),
            metadata={"deutsch": {"name": name, "description": "x"}},
            is_configured=lambda: configured,
        )

    def test_build_tools_skips_unconfigured_tools(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            "agent.tools.tools.LOCAL_TOOLS",
            [self._local_tool("on"), self._local_tool("off", configured=False)],
        )

        built = self._collection()._build_tools()

        assert [tool.name for tool in built] == ["on"]

    @pytest.mark.asyncio
    async def test_get_tools_returns_local_and_mcp_tools(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            "agent.tools.tools.LOCAL_TOOLS", [self._local_tool("simplify")]
        )
        mcp_tool = _tool("mcp-foo")
        monkeypatch.setattr(
            "agent.tools.tools.McpLoader",
            MagicMock(load_mcp_tools=AsyncMock(return_value=[mcp_tool])),
        )

        user = AuthenticationResult(user_id="u", token="t", department="d")
        tools = await self._collection().get_tools(user)

        assert tools == [tool for tool in tools if tool.name in {"simplify", "mcp-foo"}]
        assert {tool.name for tool in tools} == {"simplify", "mcp-foo"}

    @pytest.mark.asyncio
    async def test_get_tools_filters_by_enabled_tools(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            "agent.tools.tools.LOCAL_TOOLS",
            [self._local_tool("simplify"), self._local_tool("brainstorm")],
        )
        mcp_tool = _tool("mcp-foo")
        monkeypatch.setattr(
            "agent.tools.tools.McpLoader",
            MagicMock(load_mcp_tools=AsyncMock(return_value=[mcp_tool])),
        )

        user = AuthenticationResult(user_id="u", token="t", department="d")
        tools = await self._collection().get_tools(user, enabled_tools=["simplify"])

        assert [tool.name for tool in tools] == ["simplify"]

    @pytest.mark.asyncio
    async def test_mcp_loader_receives_user_info(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("agent.tools.tools.LOCAL_TOOLS", [])
        loader = MagicMock(load_mcp_tools=AsyncMock(return_value=[]))
        monkeypatch.setattr("agent.tools.tools.McpLoader", loader)

        user = AuthenticationResult(user_id="u", token="t", department="d")
        await self._collection().get_tools(user)

        loader.load_mcp_tools.assert_awaited_once_with(user_info=user)


def test_local_tools_registry_contains_expected_tools() -> None:
    """The built-in tool registry stays intact; new tools must be added there."""
    from agent.tools.tools import LOCAL_TOOLS

    ids = {tool.id for tool in LOCAL_TOOLS}
    assert {"Brainstorming", "Vereinfachen"} <= ids
    assert any(tool.mcp_group == "Canvas" for tool in LOCAL_TOOLS)
