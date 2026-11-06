from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from langchain.agents.middleware import ModelRequest, ToolCallRequest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import HumanMessage
from langgraph.runtime import Runtime

from agent.middleware import (
    ContextMiddleware,
    RequestContext,
    _filter_request_tools,
    _inject_canvas_state,
)
from api.api_models import CanvasState


def _model_request(
    messages: list[Any],
    state: dict[str, Any],
    context: RequestContext | None = None,
    tools: list[Any] | None = None,
) -> ModelRequest:
    return ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=messages,
        tools=tools or [],
        state=state,
        runtime=Runtime(context=context),
    )


def _tool_request(
    name: str,
    args: dict[str, Any],
    context: RequestContext | None = None,
    tool: Any = None,
    state: dict[str, Any] | None = None,
) -> ToolCallRequest:
    runtime = MagicMock()
    runtime.context = context
    return ToolCallRequest(
        tool_call={"name": name, "args": args, "id": "call-1", "type": "tool_call"},
        tool=tool,
        state=state or {},
        runtime=runtime,
    )


def _wrap_model_call(request: ModelRequest) -> ModelRequest:
    handler = MagicMock(return_value="response")
    ContextMiddleware().wrap_model_call(request, handler)
    return handler.call_args.args[0]


@pytest.fixture
def no_model_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "agent.middleware.ModelRegistry.get_model",
        lambda name=None: FakeListChatModel(responses=["ok"]),
    )


def test_wrap_model_call_never_injects_canvas(no_model_registry) -> None:
    """The canvas document reaches the model only through canvas_read results."""
    request = _model_request(
        [HumanMessage(content="hi")],
        {"canvas": CanvasState(content="# Doc\n\nbody", selection="body", cursor=3)},
    )

    messages = _wrap_model_call(request).messages

    assert messages == [HumanMessage(content="hi")]


def test_canvas_base_tools_survive_empty_allowlist() -> None:
    """Base tools are always offered, independently of the request allowlist."""
    tools = [
        SimpleNamespace(name="canvas_write"),
        SimpleNamespace(name="Brainstorming"),
    ]
    request = _model_request(
        [HumanMessage(content="hi")],
        {},
        context=RequestContext(enabled_tools=[]),
        tools=tools,
    )

    kept = [tool.name for tool in _filter_request_tools(request).tools or []]

    assert kept == ["canvas_write"]


def test_all_canvas_base_tools_survive_allowlist_filtering() -> None:
    context = RequestContext(enabled_tools=["canvas_edit"])
    tools = [SimpleNamespace(name="canvas_edit"), SimpleNamespace(name="canvas_read")]
    request = _model_request(
        [HumanMessage(content="hi")], {}, context=context, tools=tools
    )

    kept = [tool.name for tool in _filter_request_tools(request).tools or []]

    assert kept == ["canvas_edit", "canvas_read"]


def test_tool_call_injection_adds_hidden_canvas_state() -> None:
    context = RequestContext(canvas=CanvasState(content="doc", selection=None))
    request = _tool_request("canvas_write", {"content": "x"}, context)

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] == context.canvas


def test_tool_call_injection_reads_canvas_from_state() -> None:
    state_canvas = CanvasState(content="from state")
    request = _tool_request(
        "canvas_edit",
        {"old_text": "a", "new_text": "b"},
        state={"canvas": state_canvas},
    )

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] == state_canvas


def test_tool_call_injection_skips_non_canvas_tools() -> None:
    context = RequestContext(canvas=CanvasState(content="doc"))
    request = _tool_request("Brainstorming", {"topic": "t"}, context)

    injected = _inject_canvas_state(request)

    assert "canvas_state" not in injected.tool_call["args"]


def test_tool_call_injection_without_canvas_passes_none() -> None:
    request = _tool_request("canvas_read", {})

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] is None


def test_context_middleware_applies_tool_call_injection() -> None:
    context = RequestContext(canvas=CanvasState(content="doc"))
    request = _tool_request("canvas_write", {"content": "x"}, context)
    handler = MagicMock(return_value="response")

    ContextMiddleware().wrap_tool_call(request, handler)

    args = handler.call_args.args[0].tool_call["args"]
    assert args["canvas_state"] == context.canvas


def test_wrap_model_call_preserves_runtime_context(no_model_registry) -> None:
    # request context must survive _configure_model_request unchanged,
    # so the langfuse_prompt check after it still sees the original values
    prompt = object()
    context = RequestContext(canvas=CanvasState(content="doc"), langfuse_prompt=prompt)
    request = _model_request([HumanMessage(content="hi")], {}, context=context)

    passed = _wrap_model_call(request)

    assert passed.runtime.context is context
    assert passed.runtime.context.langfuse_prompt is prompt
