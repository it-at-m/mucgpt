from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from deepagents.middleware._tool_exclusion import _ToolExclusionMiddleware
from langchain.agents.middleware import ModelRequest, ToolCallRequest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import ToolMessage
from langchain_core.tools import StructuredTool, tool
from langgraph.runtime import Runtime

from agent.middleware import TOOL_STATUS_ARG, ToolStatusMiddleware


@tool
def search(query: str) -> str:
    """Search the knowledge base."""
    return query


@tool
def report(status_message: str) -> str:
    """A tool that has its own argument with the status name."""
    return status_message


MCP_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"query": {"type": "string", "minLength": 1}},
    "required": ["query"],
}


def _mcp_tool() -> StructuredTool:
    # MCP tools carry a plain JSON schema dict, shared with the cached tool metadata.
    return StructuredTool(
        name="search_snow_kb_eakte",
        description="Search the eAkte knowledge base.",
        args_schema=MCP_SCHEMA,
        coroutine=AsyncMock(return_value="ok"),
    )


def _model_request(tools: list[Any]) -> ModelRequest:
    return ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[],
        tools=tools,
        state={},
        runtime=Runtime(context=None),
    )


def _tools_seen_by_model(tools: list[Any]) -> list[Any]:
    handler = MagicMock(return_value="response")
    ToolStatusMiddleware().wrap_model_call(_model_request(tools), handler)
    return handler.call_args.args[0].tools


def _tool_call_request(tool_: Any, args: dict[str, Any]) -> ToolCallRequest:
    return ToolCallRequest(
        tool_call={
            "name": tool_.name,
            "args": args,
            "id": "call-1",
            "type": "tool_call",
        },
        tool=tool_,
        state={},
        runtime=MagicMock(),
    )


def test_adds_required_status_argument_first() -> None:
    [definition] = _tools_seen_by_model([search])

    assert definition["name"] == "search"
    assert list(definition["parameters"]["properties"]) == [TOOL_STATUS_ARG, "query"]
    assert definition["parameters"]["required"] == [TOOL_STATUS_ARG, "query"]


def test_does_not_change_mcp_schema_shared_with_cache() -> None:
    [definition] = _tools_seen_by_model([_mcp_tool()])

    assert TOOL_STATUS_ARG in definition["parameters"]["properties"]
    assert list(MCP_SCHEMA["properties"]) == ["query"]
    assert MCP_SCHEMA["required"] == ["query"]


def test_leaves_provider_tools_and_own_status_arguments_alone() -> None:
    provider_tool = {"type": "web_search"}

    seen = _tools_seen_by_model([provider_tool, report])

    assert seen == [provider_tool, report]


def test_tool_exclusion_still_filters_by_name() -> None:
    # Deep Agents' tool exclusion runs after this middleware and must still find the names.
    exclusion = _ToolExclusionMiddleware(excluded=frozenset({"search"}))
    handler = MagicMock(return_value="response")

    ToolStatusMiddleware().wrap_model_call(
        _model_request([search, _mcp_tool()]),
        lambda request: exclusion.wrap_model_call(request, handler),
    )

    assert [t["name"] for t in handler.call_args.args[0].tools] == [
        "search_snow_kb_eakte"
    ]


def test_removes_status_argument_before_the_tool_runs() -> None:
    handler = MagicMock(return_value=ToolMessage(content="ok", tool_call_id="call-1"))
    request = _tool_call_request(search, {TOOL_STATUS_ARG: "Suche", "query": "Kita"})

    ToolStatusMiddleware().wrap_tool_call(request, handler)

    assert handler.call_args.args[0].tool_call["args"] == {"query": "Kita"}
    assert request.tool_call["args"] == {TOOL_STATUS_ARG: "Suche", "query": "Kita"}


def test_keeps_argument_of_tools_that_define_it_themselves() -> None:
    handler = MagicMock(return_value=ToolMessage(content="ok", tool_call_id="call-1"))

    ToolStatusMiddleware().wrap_tool_call(
        _tool_call_request(report, {TOOL_STATUS_ARG: "fertig"}), handler
    )

    assert handler.call_args.args[0].tool_call["args"] == {TOOL_STATUS_ARG: "fertig"}


@pytest.mark.asyncio
async def test_async_paths_add_and_remove_the_argument() -> None:
    middleware = ToolStatusMiddleware()
    model_handler = AsyncMock(return_value="response")
    tool_handler = AsyncMock(
        return_value=ToolMessage(content="ok", tool_call_id="call-1")
    )

    await middleware.awrap_model_call(_model_request([_mcp_tool()]), model_handler)
    await middleware.awrap_tool_call(
        _tool_call_request(_mcp_tool(), {TOOL_STATUS_ARG: "Suche", "query": "eAkte"}),
        tool_handler,
    )

    [definition] = model_handler.call_args.args[0].tools
    assert definition["parameters"]["required"] == [TOOL_STATUS_ARG, "query"]
    assert tool_handler.call_args.args[0].tool_call["args"] == {"query": "eAkte"}
