"""Tests for /v1/tools metadata assembly (languages, MCP source inference)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent.tools import tool_metadata
from agent.tools.tool_metadata import (
    _infer_mcp_source,
    _resolve_lang,
    list_tool_metadata,
)
from config.harness_profiles import DEEP_AGENT_INTERNAL_TOOLS
from core.auth import AuthenticationResult


class TestResolveLang:
    @pytest.mark.parametrize(
        ("input_lang", "expected"),
        [
            ("deutsch", "deutsch"),
            ("Deutsch", "deutsch"),
            ("english", "english"),
            ("English", "english"),
            ("français", "français"),
            ("francais", "français"),
            ("french", "français"),
            ("bairisch", "bairisch"),
            ("bavarian", "bairisch"),
            ("українська", "ukrainisch"),
            ("ukrainian", "ukrainisch"),
            ("spanish", "deutsch"),  # unknown falls back to the default language
            ("", "deutsch"),
        ],
    )
    def test_language_aliases(self, input_lang: str, expected: str) -> None:
        assert _resolve_lang(input_lang) == expected


class TestInferMcpSource:
    @pytest.mark.parametrize(
        ("tool_name", "expected"),
        [
            ("docs", "docs"),  # exact match
            ("DOCS", "docs"),  # case-insensitive exact match
            ("docs__search", "docs"),  # __ separator
            ("docs:search", "docs"),  # colon
            ("docs.search", "docs"),  # dot
            ("docs/search", "docs"),  # slash
            ("docs-search", "docs"),  # dash
            ("docs_search", "docs"),  # underscore
            ("prefix_docs__search", None),  # separator prefixes must match exactly
        ],
    )
    def test_source_prefixes(self, tool_name: str, expected: str | None) -> None:
        assert _infer_mcp_source(tool_name, {"docs"}) == expected

    def test_mcp_name_pattern_fallback(self) -> None:
        # The name pattern is greedy: it consumes trailing separators too.
        assert (
            _infer_mcp_source("mcp-mydocs_search", {"unrelated"}) == "mcp-mydocs_search"
        )

    def test_no_match_returns_none(self) -> None:
        assert _infer_mcp_source("totally-local", {"docs"}) is None


def _mcp_tool(name: str, description: str, metadata: object | None = None) -> MagicMock:
    tool = MagicMock()
    tool.name = name
    tool.description = description
    tool.metadata = metadata
    return tool


@pytest.mark.asyncio
async def test_list_tool_metadata_includes_local_and_mcp_tools() -> None:
    mcp_tool = _mcp_tool(
        "docs__search",
        "Search docs",
        metadata={"mcp_group": "docs", "mcp_source": None},
    )
    with (
        patch.object(
            tool_metadata.McpLoader,
            "load_mcp_tools",
            new=AsyncMock(return_value=[mcp_tool]),
        ),
        patch.object(
            tool_metadata,
            "get_mcp_settings",
            return_value=MagicMock(sources={"docs": MagicMock()}),
        ),
    ):
        response = await list_tool_metadata(
            AuthenticationResult(user_id="u", token="t", department="d")
        )

    ids = [info.id for info in response.tools]
    assert "Vereinfachen" in ids  # local tool by id
    assert "docs__search" in ids  # MCP tool by runtime name

    docs_entry = next(info for info in response.tools if info.id == "docs__search")
    assert docs_entry.name == "docs__search"
    assert docs_entry.description == "Search docs"
    assert docs_entry.mcp_group == "docs"
    assert docs_entry.mcp_source == "docs"  # inferred from name + configured sources
    assert docs_entry.mcp_scope == "docs"

    assert response.internal_tool_ids == sorted(DEEP_AGENT_INTERNAL_TOOLS)


@pytest.mark.asyncio
async def test_list_tool_metadata_local_tool_display_uses_language() -> None:
    with (
        patch.object(tool_metadata.McpLoader, "load_mcp_tools", new=AsyncMock([])),
    ):
        response = await list_tool_metadata(
            AuthenticationResult(user_id="u", token="t", department="d"),
            lang="english",
        )

    simplify_entry = next(info for info in response.tools if info.id == "Vereinfachen")
    assert simplify_entry.description == (
        "Simplifies complex German text to A2 level using Easy Language principles."
    )


@pytest.mark.asyncio
async def test_list_tool_metadata_force_reload_is_forwarded() -> None:
    loader = AsyncMock(return_value=[])
    with patch.object(tool_metadata.McpLoader, "load_mcp_tools", new=loader):
        await list_tool_metadata(
            AuthenticationResult(user_id="u", token="t", department="d"),
            force_reload=True,
        )

    assert loader.await_args.kwargs["force_reload"] is True
