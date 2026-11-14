"""Structured internal generation must survive thinking-model responses.

Reasoning models (Mistral Large, GLM, gpt-oss) return thinking content blocks
next to the tool call. The stock ``with_structured_output`` parser expects
string content and crashes on those lists, so the tool call is extracted from
the raw response instead.
"""

from typing import Literal
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field

from api.api_models import ChatCompletionMessage
from core.llm_helpers import invoke_internal_structured_generation


class _Verdict(BaseModel):
    verdict: Literal["passed", "high_risk_detected"]
    reasoning: str | None = Field(None, max_length=1000)


class _FakeStructuredModel:
    """Mimics a thinking model: content blocks + the tool call."""

    def __init__(self):
        self.bound = None

    def bind_tools(self, schema, **kwargs):
        self.bound = kwargs
        return self

    async def ainvoke(self, messages, config=None):
        return AIMessage(
            content=[
                {"type": "thinking", "thinking": "prüfe …"},
                {"type": "text", "text": ""},
            ],
            tool_calls=[
                {"name": "_Verdict", "args": {"verdict": "passed"}, "id": "c1"}
            ],
        )


@pytest.fixture
def registered_model(monkeypatch: pytest.MonkeyPatch) -> _FakeStructuredModel:
    fake = _FakeStructuredModel()
    monkeypatch.setattr("core.llm_helpers.ModelRegistry.get_model", lambda _n: fake)
    monkeypatch.setattr(
        "core.llm_helpers.ModelRegistry._models_without_temperature", set()
    )
    monkeypatch.setattr("core.llm_helpers.ModelRegistry._models_without_user", set())
    monkeypatch.setattr(
        "core.llm_helpers.ModelRegistry.normalize_model_settings",
        lambda model, settings: settings,
    )
    return fake


@pytest.mark.asyncio
async def test_tool_call_extracted_from_thinking_content(registered_model):
    user = MagicMock(user_id="u", token="t", department="TEAM/1")
    result = await invoke_internal_structured_generation(
        model_name="thinking-model",
        temperature=0.0,
        messages=[ChatCompletionMessage(role="user", content="prompt")],
        user_info=user,
        trace_tags=[],
        run_name="test-check",
        schema=_Verdict,
    )
    assert isinstance(result, _Verdict)
    assert result.verdict == "passed"


@pytest.mark.asyncio
async def test_raises_when_model_returns_no_tool_call(registered_model):
    async def no_tool_call(messages, config=None):
        return AIMessage(content=[{"type": "thinking", "thinking": "…"}])

    registered_model.ainvoke = no_tool_call
    user = MagicMock(user_id="u", token="t", department="TEAM/1")
    with pytest.raises(ValueError, match="no tool call"):
        await invoke_internal_structured_generation(
            model_name="thinking-model",
            temperature=0.0,
            messages=[ChatCompletionMessage(role="user", content="prompt")],
            user_info=user,
            trace_tags=[],
            run_name="test-check",
            schema=_Verdict,
        )


@pytest.mark.asyncio
async def test_bind_receives_normalized_settings(registered_model):
    user = MagicMock(user_id="u", token="t", department="TEAM/1")
    await invoke_internal_structured_generation(
        model_name="thinking-model",
        temperature=0.0,
        messages=[ChatCompletionMessage(role="user", content="prompt")],
        user_info=user,
        trace_tags=[],
        run_name="test-check",
        schema=_Verdict,
    )
    # the settings flow through normalize into bind (the user-field stripping
    # itself is covered by the model-capability tests)
    assert registered_model.bound["temperature"] == 0.0
    assert registered_model.bound["stream"] is False
