import pytest
from pydantic import ValidationError

from api.api_models import CANVAS_CONTENT_MAX_CHARS, CanvasState, ChatCompletionRequest


def test_canvas_limits_are_pinned() -> None:
    # the numbers are user-facing (banner texts, docs); pin them explicitly
    assert CANVAS_CONTENT_MAX_CHARS == 256 * 1024
    assert len("x" * CANVAS_CONTENT_MAX_CHARS) == 262_144


class TestCanvasStateSizeLimit:
    def test_rejects_oversized_content(self) -> None:
        with pytest.raises(ValidationError):
            CanvasState(content="x" * (CANVAS_CONTENT_MAX_CHARS + 1))

    def test_rejects_oversized_selection(self) -> None:
        with pytest.raises(ValidationError):
            CanvasState(content="ok", selection="x" * (CANVAS_CONTENT_MAX_CHARS + 1))

    def test_accepts_fields_at_the_limit(self) -> None:
        canvas = CanvasState(
            content="x" * CANVAS_CONTENT_MAX_CHARS,
            selection="y" * CANVAS_CONTENT_MAX_CHARS,
        )

        assert len(canvas.content) == CANVAS_CONTENT_MAX_CHARS
        assert len(canvas.selection) == CANVAS_CONTENT_MAX_CHARS


class TestChatCompletionRequestConversationId:
    """conversation_id is optional and must not affect existing behavior."""

    def test_conversation_id_defaults_to_none(self) -> None:
        request = ChatCompletionRequest(
            messages=[{"role": "user", "content": "hi"}],
        )

        assert request.conversation_id is None
        assert request.model is None
        assert request.reasoning_effort is None

    def test_conversation_id_is_accepted_when_provided(self) -> None:
        request = ChatCompletionRequest(
            messages=[{"role": "user", "content": "hi"}],
            conversation_id="6f3a1e2c-9b7d-4a3f-9e3a-2c1b9d8f6a10",
        )

        assert request.conversation_id == "6f3a1e2c-9b7d-4a3f-9e3a-2c1b9d8f6a10"


class TestChatCompletionRequestReasoningEffort:
    """reasoning_effort accepts the full ladder including "max" (#1408)."""

    def test_reasoning_effort_max_is_accepted(self) -> None:
        """Privatemode-style GLM models accept reasoning_effort "max" (#1408)."""
        request = ChatCompletionRequest(
            messages=[{"role": "user", "content": "hi"}],
            reasoning_effort="max",
        )

        assert request.reasoning_effort == "max"

    def test_reasoning_effort_unknown_value_is_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ChatCompletionRequest.model_validate(
                {"messages": [{"role": "user", "content": "hi"}], "reasoning_effort": "extreme"}
            )
