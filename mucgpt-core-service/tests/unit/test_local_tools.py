import logging
from typing import Any

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from pydantic import Field

from agent.agent_executor import _is_internal_chunk
from agent.middleware import RequestContext
from agent.tools.brainstorm import make_brainstorm_tool
from agent.tools.simplify import make_simplify_tool
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from config.model_provider import ModelRegistry


class AsyncOnlyChatModel(BaseChatModel):
    model_name: str = "test-model"
    responses: list[str]
    calls: list[dict[str, Any]] = Field(default_factory=list)
    fail: bool = False

    @property
    def _llm_type(self):
        return "async-only-test-model"

    def _generate(self, *args, **kwargs):
        raise AssertionError("Local tools must use async model calls")

    async def _astream(self, messages, stop=None, run_manager=None, **kwargs):
        self.calls.append({"messages": messages, **kwargs})
        if self.fail:
            raise TimeoutError("model timed out")
        yield ChatGenerationChunk(
            message=AIMessageChunk(
                content=[{"type": "reasoning", "reasoning": "hidden reasoning"}]
            )
        )
        yield ChatGenerationChunk(
            message=AIMessageChunk(
                content=[{"type": "text", "text": self.responses[len(self.calls) - 1]}]
            )
        )


async def _run_tool(tool, args, context=None):
    workflow = StateGraph(MessagesState, context_schema=RequestContext)
    workflow.add_node("tools", ToolNode([tool]))
    workflow.add_edge(START, "tools")
    workflow.add_edge("tools", END)
    graph = workflow.compile()
    events = []
    model_chunks = []
    result = None
    async for mode, data in graph.astream(
        {
            "messages": [
                AIMessage(
                    content="",
                    tool_calls=[{"name": tool.name, "args": args, "id": "call-1"}],
                )
            ]
        },
        context=context or RequestContext(),
        stream_mode=["messages", "custom", "updates"],
    ):
        if mode == "custom":
            events.append(ToolStreamChunk.model_validate_json(data))
        elif mode == "updates":
            result = data["tools"]["messages"][0].content
        elif mode == "messages" and isinstance(data[0], AIMessageChunk):
            model_chunks.append(data)
    assert all(_is_internal_chunk(metadata) for _, metadata in model_chunks)
    assert "runtime" not in tool.args
    assert all("hidden reasoning" not in event.content for event in events)
    assert events[0].state == ToolStreamState.STARTED
    assert events[-1].state == ToolStreamState.ENDED
    return result, events


@pytest.mark.asyncio
@pytest.mark.parametrize("refine", [False, True])
async def test_brainstorm_streams_markdown_and_supports_refinement(refine):
    model = AsyncOnlyChatModel(responses=["# Mobilität\n**Mobilität**\n## Fahrrad"])
    tool = make_brainstorm_tool(model, logging.getLogger("test"))
    args = {"topic": "Mobilität", "context": "Mehr Radwege"}
    if refine:
        args.update(existing_mindmap="# Mobilität", feedback="Fahrräder ergänzen")

    result, events = await _run_tool(tool, args)

    assert result == model.responses[0]
    assert len(model.calls) == 1
    assert all(event.state != ToolStreamState.APPEND for event in events)
    prompt = model.calls[0]["messages"][1].content
    assert f"MODE: {'REFINE' if refine else 'CREATE'}" in prompt
    assert "Mehr Radwege" in prompt
    assert any(
        event.state == ToolStreamState.UPDATE and event.content == result
        for event in events
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("critique", ["No issues found.", "Use shorter sentences."])
async def test_simplify_checks_quality_and_refines_at_most_once(critique):
    model = AsyncOnlyChatModel(
        responses=[
            "Bitte stellen Sie einen Antrag.",
            critique,
            "Bitte füllen Sie das Formular aus.",
        ]
    )
    tool = make_simplify_tool(model, logging.getLogger("test"))

    result, events = await _run_tool(
        tool, {"text": "Die Antragstellung ist erforderlich."}
    )

    expected_calls = 2 if critique == "No issues found." else 3
    assert len(model.calls) == expected_calls
    assert result == model.responses[0 if expected_calls == 2 else 2]
    assert any("SIMPLIFY_GENERATE" in event.content for event in events)
    assert any("SIMPLIFY_CRITIQUE" in event.content for event in events)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "factory,args",
    [
        (make_brainstorm_tool, {"topic": "Mobilität"}),
        (make_simplify_tool, {"text": "Ein Antrag ist erforderlich."}),
    ],
)
@pytest.mark.parametrize("reasoning", [False, True])
@pytest.mark.parametrize("effort", [None, "minimal", "high"])
async def test_tools_apply_current_request_model_and_supported_settings(
    monkeypatch, factory, args, reasoning, effort
):
    bootstrap = AsyncOnlyChatModel(responses=[])
    selected = AsyncOnlyChatModel(
        model_name="selected-model", responses=["Ergebnis", "No issues found."]
    )
    monkeypatch.setattr(ModelRegistry, "_models", {"selected-model": selected})
    monkeypatch.setattr(ModelRegistry, "_default_model", bootstrap)
    monkeypatch.setattr(
        ModelRegistry, "_reasoning_models", {"selected-model"} if reasoning else set()
    )
    monkeypatch.setattr(
        ModelRegistry,
        "_supported_reasoning_efforts",
        {"selected-model": ("low", "high")},
    )
    monkeypatch.setattr(
        ModelRegistry, "_default_reasoning_efforts", {"selected-model": "low"}
    )
    monkeypatch.setattr(ModelRegistry, "_models_without_temperature", set())
    extra_body = {"metadata": {"tags": ["assistant-1"]}, "custom": True}
    context = RequestContext(
        model_name="selected-model",
        temperature=0.2,
        reasoning_effort=effort,
        user="POR",
        extra_body=extra_body,
        stream=False,
    )
    tool = factory(bootstrap, logging.getLogger("test"))

    await _run_tool(tool, args, context)

    assert not bootstrap.calls
    for call in selected.calls:
        assert call["stream"] is True
        assert call["user"] == "POR"
        assert call["extra_body"] == {
            "metadata": {"tags": ["assistant-1", f"MUCGPT_TOOL_NAME:{tool.name}"]},
            "custom": True,
        }
        if reasoning:
            assert "temperature" not in call
            assert call["reasoning_effort"] == ("high" if effort == "high" else "low")
        else:
            assert call["temperature"] == 0.2
            assert "reasoning_effort" not in call
    assert extra_body == {"metadata": {"tags": ["assistant-1"]}, "custom": True}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "factory,args",
    [
        (make_brainstorm_tool, {"topic": "Mobilität"}),
        (make_simplify_tool, {"text": "Ein Antrag ist erforderlich."}),
    ],
)
async def test_tools_finish_progress_when_model_call_fails(factory, args):
    model = AsyncOnlyChatModel(responses=[], fail=True)
    tool = factory(model, logging.getLogger("test"))

    result, _ = await _run_tool(tool, args)

    assert "Error" in result or "Fehler" in result
    assert len(model.calls) == 1
