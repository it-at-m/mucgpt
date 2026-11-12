"""Executor groundwork tests for native AG-UI run input (issue #1448, Path A).

Covers the boundary-event identity contract (runId echo + protocolVersion
declaration), the language passthrough, and the dormant interrupt/resume
machinery (#1093/#1085 build on it).
"""

from contextlib import nullcontext
from types import SimpleNamespace
from typing import Any

import pytest
from ag_ui.core.events import EventType
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.types import Command, Interrupt

from agent.agent_executor import MUCGPTAgentExecutor
from api.api_models import ChatCompletionMessage as InputMessage
from core.auth_models import AuthenticationResult


class FakeLangfuseClient:
    """Minimal Langfuse client stand-in (same shape as in test_agent_executor)."""

    def __init__(self):
        self.current_span_updates = []
        self.spans = []

    def update_current_span(self, **kwargs):
        self.current_span_updates.append(kwargs)

    def start_as_current_observation(self, **_kwargs):
        span = SimpleNamespace(updates=[])
        self.spans.append(span)
        return nullcontext(span)


def _runner(monkeypatch, agent):
    langfuse_client = FakeLangfuseClient()
    monkeypatch.setattr("agent.agent_executor.get_client", lambda: langfuse_client)
    monkeypatch.setattr(
        "agent.agent_executor.propagate_attributes",
        lambda **_kwargs: nullcontext(),
    )
    return MUCGPTAgentExecutor(agent)


def _user():
    return AuthenticationResult(token="t", user_id="u", department="d")


class RecordingGraph:
    """Captures the input and config, streams a minimal visible response."""

    def __init__(self, chunks=None):
        self.chunks = chunks or []
        self.input: Any = None
        self.config: Any = None

    async def astream(self, input, *_args, **kwargs):
        self.input = input
        self.config = kwargs["config"]
        for chunk in self.chunks:
            yield chunk


class InterruptedGraph(RecordingGraph):
    """A graph that ends its run on a LangGraph interrupt."""

    def __init__(self, interrupts):
        super().__init__(chunks=[("updates", {"__interrupt__": interrupts})])
        self.state = SimpleNamespace(
            values={
                "messages": [
                    HumanMessage(content="delete the file", id="m1"),
                    AIMessage(content="", id="m2"),
                ]
            }
        )

    async def aget_state(self, _config: Any) -> Any:
        self.state_seen_with = _config
        return self.state


class InterruptedAgent:
    def __init__(self, graph):
        self.graph = graph
        self.default_langfuse_prompt = None


@pytest.mark.asyncio
async def test_boundary_events_echo_input_run_id_and_declare_protocol_version(
    monkeypatch,
):
    graph = RecordingGraph(
        chunks=[
            (
                "messages",
                (AIMessageChunk(content="hi"), {"langgraph_node": "model"}),
            )
        ]
    )
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    events = [
        event
        async for event in runner.run_agui_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.5,
            model=None,
            user_info=_user(),
            conversation_id="conv-1",
            run_id="run-42",
        )
    ]

    started = events[0]
    assert started.type == EventType.RUN_STARTED
    assert started.thread_id == "conv-1"
    assert started.run_id == "run-42"
    assert started.protocol_version == "1.0"
    finished = next(e for e in events if e.type == EventType.RUN_FINISHED)
    assert finished.run_id == "run-42"
    assert finished.thread_id == "conv-1"


@pytest.mark.asyncio
async def test_boundary_events_mint_a_fresh_run_id_without_input_identity(
    monkeypatch,
):
    graph = RecordingGraph()
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    events = [
        event
        async for event in runner.run_agui_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.5,
            model=None,
            user_info=_user(),
            conversation_id="conv-1",
        )
    ]

    started = events[0]
    assert started.run_id
    finished = next(e for e in events if e.type == EventType.RUN_FINISHED)
    assert finished.run_id == started.run_id


@pytest.mark.asyncio
async def test_language_reaches_the_graph_config(monkeypatch):
    graph = RecordingGraph()
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    async for _ in runner.run_agui_with_streaming(
        messages=[InputMessage(role="user", content="hi")],
        temperature=0.5,
        model=None,
        user_info=_user(),
        conversation_id="conv-1",
        language="German",
    ):
        pass

    assert graph.config["configurable"]["language"] == "German"


@pytest.mark.asyncio
async def test_resume_is_sent_as_a_command_keyed_by_interrupt_id(monkeypatch):
    graph = RecordingGraph()
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    async for _ in runner.run_agui_with_streaming(
        messages=[InputMessage(role="user", content="hi")],
        temperature=0.5,
        model=None,
        user_info=_user(),
        conversation_id="conv-1",
        resume={"i1": {"answer": "yes"}},
    ):
        pass

    assert isinstance(graph.input, Command)
    assert graph.input.resume == {"i1": {"answer": "yes"}}


@pytest.mark.asyncio
async def test_plain_turn_sends_messages_not_a_command(monkeypatch):
    graph = RecordingGraph()
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    async for _ in runner.run_agui_with_streaming(
        messages=[InputMessage(role="user", content="hi")],
        temperature=0.5,
        model=None,
        user_info=_user(),
        conversation_id="conv-1",
    ):
        pass

    assert isinstance(graph.input, dict)
    assert [type(m).__name__ for m in graph.input["messages"]] == ["HumanMessage"]


@pytest.mark.asyncio
async def test_interrupted_run_emits_snapshots_and_interrupt_outcome(monkeypatch):
    graph = InterruptedGraph(interrupts=(Interrupt(value={"tool_call_id": "tc1"}),))
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    events = [
        event
        async for event in runner.run_agui_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.5,
            model=None,
            user_info=_user(),
            conversation_id="conv-1",
            run_id="run-7",
        )
    ]

    state_snapshot = next(e for e in events if e.type == EventType.STATE_SNAPSHOT)
    assert "messages" in state_snapshot.snapshot

    messages_snapshot = next(
        e for e in events if e.type == EventType.MESSAGES_SNAPSHOT
    )
    assert [m.content for m in messages_snapshot.messages] == [
        "delete the file",
        "",
    ]

    finished = next(e for e in events if e.type == EventType.RUN_FINISHED)
    assert finished.run_id == "run-7"
    assert finished.outcome.type == "interrupt"
    assert finished.outcome.interrupts[0].tool_call_id == "tc1"
    assert finished.outcome.interrupts[0].reason == "tool_call"
    # no success result on an interrupted run
    assert not hasattr(finished, "result") or finished.result is None


@pytest.mark.asyncio
async def test_interrupt_snapshot_failure_still_finishes_with_outcome(monkeypatch):
    graph = InterruptedGraph(interrupts=(Interrupt(value=None),))

    async def broken_aget_state(_config):
        raise RuntimeError("state store unavailable")

    graph.aget_state = broken_aget_state
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    events = [
        event
        async for event in runner.run_agui_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.5,
            model=None,
            user_info=_user(),
            conversation_id="conv-1",
        )
    ]

    assert not any(e.type == EventType.STATE_SNAPSHOT for e in events)
    finished = next(e for e in events if e.type == EventType.RUN_FINISHED)
    assert finished.outcome.type == "interrupt"


@pytest.mark.asyncio
async def test_interrupt_outcome_maps_langgraph_interrupt_fields(monkeypatch):
    interrupt = Interrupt(
        value={"tool_call_id": "tc-9", "reason": "approve_edit"},
        response_schema={"type": "object"},
    )
    graph = InterruptedGraph(interrupts=(interrupt,))
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    events = [
        event
        async for event in runner.run_agui_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.5,
            model=None,
            user_info=_user(),
            conversation_id="conv-1",
        )
    ]

    finished = next(e for e in events if e.type == EventType.RUN_FINISHED)
    outcome = finished.outcome.interrupts[0]
    assert outcome.tool_call_id == "tc-9"
    assert outcome.reason == "approve_edit"
    assert outcome.response_schema == {"type": "object"}


@pytest.mark.asyncio
async def test_aget_state_receives_the_run_config(monkeypatch):
    graph = InterruptedGraph(interrupts=(Interrupt(value=None),))
    runner = _runner(monkeypatch, InterruptedAgent(graph))

    async for _ in runner.run_agui_with_streaming(
        messages=[InputMessage(role="user", content="hi")],
        temperature=0.5,
        model=None,
        user_info=_user(),
        conversation_id="conv-1",
    ):
        pass

    assert graph.state_seen_with is graph.config


def test_request_context_language_field_exists():
    from agent.middleware import RequestContext

    context = RequestContext(language="German")
    assert context.language == "German"
    assert RequestContext().language is None
