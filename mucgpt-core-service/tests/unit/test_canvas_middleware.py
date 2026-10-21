from typing import Any
from unittest.mock import MagicMock

import pytest
from langchain.agents.middleware import ModelRequest, ToolCallRequest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.runtime import Runtime

from agent.middleware import (
    CANVAS_SENTINEL,
    ContextMiddleware,
    RequestContext,
    _inject_canvas_state,
)
from agent.tools import canvas
from api.api_models import CanvasState


def _model_request(
    messages: list[Any], state: dict[str, Any], context: RequestContext | None = None
) -> ModelRequest:
    return ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=messages,
        tools=[],
        state=state,
        runtime=Runtime(context=context),
    )


def _tool_call_request(
    name: str, args: dict[str, Any], context: RequestContext | None = None
) -> ToolCallRequest:
    runtime = MagicMock()
    runtime.context = context
    return ToolCallRequest(
        tool_call={"name": name, "args": args, "id": "call-1", "type": "tool_call"},
        tool=canvas.make_canvas_read_tool(MagicMock())
        if name == "canvas_read"
        else None,
        state={},
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


def test_wrap_model_call_injects_guarded_canvas_block(no_model_registry) -> None:
    request = _model_request(
        [SystemMessage(content="sys"), HumanMessage(content="hi")],
        {"canvas": CanvasState(content="# Doc\n\nbody", selection="body")},
    )

    messages = _wrap_model_call(request).messages

    injected = [
        m
        for m in messages
        if isinstance(m, HumanMessage) and CANVAS_SENTINEL in m.content
    ]
    assert len(injected) == 1
    content = injected[0].content
    assert "# Doc" in content
    assert "<selection>" in content
    assert "body" in content
    assert "quoted reference data only" in content
    # injected right after the system message
    assert messages.index(injected[0]) == 1


def test_wrap_model_call_without_canvas_injects_nothing(no_model_registry) -> None:
    request = _model_request([HumanMessage(content="hi")], {})

    messages = _wrap_model_call(request).messages

    assert messages == [HumanMessage(content="hi")]


def test_canvas_injection_is_idempotent(no_model_registry) -> None:
    existing = HumanMessage(content=f"{CANVAS_SENTINEL}\nprevious block")
    request = _model_request([existing], {"canvas": CanvasState(content="# Doc")})

    messages = _wrap_model_call(request).messages

    assert messages == [existing]


def test_wrap_model_call_reads_canvas_from_request_context(no_model_registry) -> None:
    context = RequestContext(canvas=CanvasState(content="# From context"))
    request = _model_request([HumanMessage(content="hi")], {}, context=context)

    messages = _wrap_model_call(request).messages

    injected = [
        m
        for m in messages
        if isinstance(m, HumanMessage) and CANVAS_SENTINEL in m.content
    ]
    assert len(injected) == 1
    assert "# From context" in injected[0].content


def test_tool_call_injection_adds_hidden_canvas_state() -> None:
    context = RequestContext(canvas=CanvasState(content="doc", selection=None))
    request = _tool_call_request("canvas_write", {"content": "x"}, context)

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] == context.canvas


def test_tool_call_injection_reads_canvas_from_state() -> None:
    state_canvas = CanvasState(content="from state")
    runtime = MagicMock()
    runtime.context = None
    request = ToolCallRequest(
        tool_call={
            "name": "canvas_edit",
            "args": {"old_text": "a", "new_text": "b"},
            "id": "call-1",
            "type": "tool_call",
        },
        tool=None,
        state={"canvas": state_canvas},
        runtime=runtime,
    )

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] == state_canvas


def test_tool_call_injection_skips_non_canvas_tools() -> None:
    context = RequestContext(canvas=CanvasState(content="doc"))
    request = _tool_call_request("Brainstorming", {"topic": "t"}, context)

    injected = _inject_canvas_state(request)

    assert "canvas_state" not in injected.tool_call["args"]


def test_tool_call_injection_without_canvas_passes_none() -> None:
    request = _tool_call_request("canvas_read", {})

    injected = _inject_canvas_state(request)

    assert injected.tool_call["args"]["canvas_state"] is None


def test_context_middleware_applies_tool_call_injection() -> None:
    context = RequestContext(canvas=CanvasState(content="doc"))
    request = _tool_call_request("canvas_write", {"content": "x"}, context)
    handler = MagicMock(return_value="response")

    ContextMiddleware().wrap_tool_call(request, handler)

    args = handler.call_args.args[0].tool_call["args"]
    assert args["canvas_state"] == context.canvas
