from api.api_models import ChatCompletionRequest


class TestChatCompletionRequestConversationId:
    """conversation_id is optional and must not affect existing behavior."""

    def test_conversation_id_defaults_to_none(self) -> None:
        request = ChatCompletionRequest(
            messages=[{"role": "user", "content": "hi"}],
        )

        assert request.conversation_id is None

    def test_conversation_id_is_accepted_when_provided(self) -> None:
        request = ChatCompletionRequest(
            messages=[{"role": "user", "content": "hi"}],
            conversation_id="6f3a1e2c-9b7d-4a3f-9e3a-2c1b9d8f6a10",
        )

        assert request.conversation_id == "6f3a1e2c-9b7d-4a3f-9e3a-2c1b9d8f6a10"
