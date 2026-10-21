from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from core.persistance_helpers import PersistanceHelpers


@pytest.mark.unit
@pytest.mark.asyncio
async def test_history_restores_steps_per_turn_without_exposing_tool_results(
    monkeypatch,
):
    messages = [
        SystemMessage(content="Instructions"),
        HumanMessage(content="First question"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "search",
                    "name": "InternetSearch",
                    "args": {
                        "status_message": " Suche  nach Kita-Gebühren ",
                        "query": "Kita Gebühren",
                        "secret": "hidden",
                    },
                },
                {
                    "id": "read",
                    "name": "web_url_read",
                    "args": {"url": "https://muenchen.de"},
                },
            ],
        ),
        # Results may arrive in a different order than the calls.
        ToolMessage(content="Failed", tool_call_id="read", status="error"),
        ToolMessage(content="Private raw result", tool_call_id="search"),
        AIMessage(content="First answer"),
        HumanMessage(content="Second question"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "failed",
                    "name": "search",
                    "args": {"status_message": 42, "query": 12, "q": "fallback"},
                },
                {"id": "interrupted", "name": "search", "args": {}},
            ],
        ),
        ToolMessage(
            content="Tool execution failed: unavailable", tool_call_id="failed"
        ),
        AIMessage(content="Second answer"),
    ]
    saver = Mock(
        aget=AsyncMock(return_value={"channel_values": {"messages": messages}})
    )
    monkeypatch.setattr(PersistanceHelpers, "_checkpointer", saver)

    history = await PersistanceHelpers.get_conversation_messages("thread")

    saver.aget.assert_awaited_once_with({"configurable": {"thread_id": "thread"}})
    assert [(message.role, message.content) for message in history] == [
        ("user", "First question"),
        ("assistant", "First answer"),
        ("user", "Second question"),
        ("assistant", "Second answer"),
    ]
    assert [
        step.model_dump(exclude_none=True) for step in history[0].activity_steps
    ] == [
        {
            "tool_call_id": "search",
            "tool_name": "InternetSearch",
            "status": "done",
            "description": "Suche nach Kita-Gebühren",
            "detail": "Kita Gebühren",
        },
        {
            "tool_call_id": "read",
            "tool_name": "web_url_read",
            "status": "error",
            "detail": "https://muenchen.de",
        },
    ]
    assert [step.status for step in history[2].activity_steps] == ["error", "error"]
    assert history[2].activity_steps[0].description is None
    assert history[2].activity_steps[0].detail == "fallback"
    assert not history[1].activity_steps
    assert "Private raw result" not in str(history)
    assert "hidden" not in str(history)


@pytest.mark.unit
@pytest.mark.asyncio
@pytest.mark.parametrize("checkpoint", [None, {"channel_values": {}}])
async def test_missing_checkpoint_history_is_empty(monkeypatch, checkpoint):
    monkeypatch.setattr(
        PersistanceHelpers,
        "_checkpointer",
        Mock(aget=AsyncMock(return_value=checkpoint)),
    )
    assert await PersistanceHelpers.get_conversation_messages("thread") == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_history_restores_latest_usage_per_turn_and_legacy_context(monkeypatch):
    from config.settings import get_settings

    model = get_settings().MODELS[0]
    snapshot = {
        "context_tokens": 240,
        "user_tokens": 300,
        "tokens": 60,
        "usage_cost": 0.04,
        "usage_model": "historical-model",
        "usage_max_input_tokens": 10000,
        "usage_context_warning_threshold_percent": 60,
        "usage_context_critical_threshold_percent": 80,
    }
    messages = [
        HumanMessage(content="Question"),
        AIMessage(
            content="",
            tool_calls=[{"id": "search", "name": "search", "args": {}}],
            response_metadata={"mucgpt_usage": {"context_tokens": 120}},
        ),
        ToolMessage(content="result", tool_call_id="search"),
        AIMessage(content="Answer", response_metadata={"mucgpt_usage": snapshot}),
        HumanMessage(content="Legacy question"),
        AIMessage(
            content="Legacy answer",
            response_metadata={"model_name": model.llm_name},
            usage_metadata={
                "input_tokens": 400,
                "output_tokens": 50,
                "total_tokens": 450,
            },
        ),
        HumanMessage(content="Unknown model"),
        AIMessage(
            content="Answer",
            response_metadata={
                "model_name": "unknown",
                "mucgpt_usage": {"context_tokens": -1},
            },
            usage_metadata={"input_tokens": 10, "output_tokens": 2, "total_tokens": 12},
        ),
        HumanMessage(content="No usage"),
        AIMessage(content="Answer"),
    ]
    monkeypatch.setattr(
        PersistanceHelpers,
        "_checkpointer",
        Mock(aget=AsyncMock(return_value={"channel_values": {"messages": messages}})),
    )

    history = await PersistanceHelpers.get_conversation_messages("thread")

    assert history[0].usage.model_dump(exclude_none=True) == snapshot
    assert history[2].usage.context_tokens == 450
    assert history[2].usage.usage_max_input_tokens == model.max_input_tokens
    assert history[2].usage.user_tokens is None
    assert history[4].usage.context_tokens == 12
    assert history[4].usage.usage_max_input_tokens is None
    assert history[6].usage is None
