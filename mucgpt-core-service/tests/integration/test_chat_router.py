# tests/integration/test_chat_router.py
import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.api_models import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionDelta,
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    Usage,
)

# No need to include the router again since it's already included in backend.py
# We're testing the mounted application directly


# These fixtures are imported from conftest.py
class TestChatRouter:
    @patch("api.routers.chat_router.agent_executor")
    def test_non_streaming_completion(self, mock_chat_service, test_client: TestClient):
        """Test the non-streaming chat completion endpoint."""
        # Mock the chat service response using proper models
        mock_response = ChatCompletionResponse(
            id="chatcmpl-test123",
            object="chat.completion",
            created=1234567890,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatCompletionMessage(
                        role="assistant", content="Hello! How can I help you today?"
                    ),
                    finish_reason="stop",
                )
            ],
            usage=Usage(prompt_tokens=10, completion_tokens=8, total_tokens=18),
        )
        mock_chat_service.run_without_streaming.return_value = (
            mock_response.model_dump()
        )

        # Create payload using proper model, now with enabled_tools
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[
                ChatCompletionMessage(
                    role="system", content="You are a test assistant."
                ),
                ChatCompletionMessage(role="user", content="Say hello."),
            ],
            temperature=0.0,
            max_tokens=10,
            stream=False,
            enabled_tools=["tool1", "tool2"],
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200, resp.text

        # Parse response into model
        response = ChatCompletionResponse.model_validate(resp.json())

        # Validate response structure
        assert response.id and isinstance(response.id, str)
        assert response.object == "chat.completion"
        assert response.created and isinstance(response.created, int)
        assert isinstance(response.choices, list) and len(response.choices) == 1

        # Validate choice content
        choice = response.choices[0]
        assert choice.index == 0
        assert choice.message.role == "assistant"
        assert choice.message.content
        assert choice.finish_reason

        # Validate usage information
        assert response.usage.prompt_tokens > 0
        assert response.usage.completion_tokens > 0
        assert response.usage.total_tokens > 0

    @patch("api.routers.chat_router.agent_executor")
    def test_streaming_completion(self, mock_chat_service, test_client: TestClient):
        """Test the streaming chat completion endpoint."""
        # Mock streaming response - return an async generator that yields JSON strings

        async def mock_streaming_generator():
            # First chunk
            chunk1 = ChatCompletionChunk(
                id="chatcmpl-stream123",
                object="chat.completion.chunk",
                created=1234567890,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionDelta(content="Hello"),
                        finish_reason=None,
                    )
                ],
            )
            yield chunk1.model_dump()

            # Second chunk
            chunk2 = ChatCompletionChunk(
                id="chatcmpl-stream123",
                object="chat.completion.chunk",
                created=1234567890,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionDelta(content=" world!"),
                        finish_reason=None,
                    )
                ],
            )
            yield chunk2.model_dump()

            # Final chunk
            chunk3 = ChatCompletionChunk(
                id="chatcmpl-stream123",
                object="chat.completion.chunk",
                created=1234567890,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0, delta=ChatCompletionDelta(), finish_reason="stop"
                    )
                ],
            )
            yield chunk3.model_dump()

        mock_chat_service.run_with_streaming.return_value = mock_streaming_generator()
        # Create payload using proper model, now with enabled_tools
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[
                ChatCompletionMessage(
                    role="system", content="You are a test assistant."
                ),
                ChatCompletionMessage(role="user", content="Stream hi."),
            ],
            temperature=0.0,
            max_tokens=10,
            stream=True,
            enabled_tools=["tool1", "tool2"],
        )
        payload = payload_model.model_dump()

        # Make streaming request
        with test_client.stream("POST", "/v1/chat/completions", json=payload) as resp:
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

            # Process the stream
            found_chunk = False
            stream_id = None
            content_buffer = ""

            for line in resp.iter_lines():
                if not line:
                    continue

                line_text = line.strip()
                if not line_text or line_text.startswith("data: [DONE]"):
                    continue

                # Remove "data: " prefix if present
                if line_text.startswith("data: "):
                    chunk = line_text[6:]
                else:
                    chunk = line_text

                try:
                    # Parse chunk into model
                    chunk_data = ChatCompletionChunk.model_validate_json(chunk)
                except json.JSONDecodeError:
                    continue

                # Basic structure validation
                assert chunk_data.id
                assert chunk_data.object == "chat.completion.chunk"
                assert isinstance(chunk_data.choices, list)

                # All chunks should have the same ID
                if stream_id is None:
                    stream_id = chunk_data.id
                else:
                    assert stream_id == chunk_data.id

                # Process first choice content
                if chunk_data.choices:
                    choice = chunk_data.choices[0]

                    # Check if this chunk contains content
                    if choice.delta.content not in [None, ""]:
                        content_buffer += choice.delta.content

                    # Check for completion signal
                    if choice.finish_reason == "stop":
                        found_chunk = True
                        break

                found_chunk = True

            assert found_chunk, "No valid chunks received"
            # Assert the combined content is as expected
            assert content_buffer == "Hello world!", (
                f"Combined content was: {content_buffer}"
            )

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_invalid_model(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion with invalid model."""
        mock_chat_service.run_without_streaming.side_effect = Exception("Invalid model")

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="invalid-model",
            messages=[ChatCompletionMessage(role="user", content="Hello")],
            stream=False,
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 500

    def test_chat_completion_missing_messages(self, test_client: TestClient):
        """Test chat completion with missing messages."""
        # Note: We can't use ChatCompletionRequest here because messages is required
        # So we test with raw dict to simulate malformed request
        payload = {"model": "gpt-4o-mini", "stream": False}
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 422

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_empty_messages(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion with empty messages array."""
        mock_chat_service.run_without_streaming.side_effect = Exception(
            "Empty messages"
        )

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini", messages=[], stream=False
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 500

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_high_temperature(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion with high temperature."""
        mock_response = ChatCompletionResponse(
            id="chatcmpl-test123",
            object="chat.completion",
            created=1234567890,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatCompletionMessage(
                        role="assistant", content="Creative response!"
                    ),
                    finish_reason="stop",
                )
            ],
            usage=Usage(prompt_tokens=5, completion_tokens=3, total_tokens=8),
        )
        mock_chat_service.run_without_streaming.return_value = (
            mock_response.model_dump()
        )

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[ChatCompletionMessage(role="user", content="Be creative")],
            temperature=1.5,
            stream=False,
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200

        # Parse response into model
        response = ChatCompletionResponse.model_validate(resp.json())
        assert response.id
        assert response.choices[0].message.content

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_zero_max_tokens(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion with zero max tokens."""
        mock_chat_service.run_without_streaming.side_effect = Exception(
            "Zero max tokens"
        )

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[ChatCompletionMessage(role="user", content="Hello")],
            max_tokens=0,
            stream=False,
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        # Should either work with 0 tokens or return error
        assert resp.status_code in [200, 422, 500]

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_service_exception(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion when service raises exception."""
        mock_chat_service.run_without_streaming.side_effect = Exception("Service error")

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[ChatCompletionMessage(role="user", content="Hello")],
            stream=False,
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 500

    @patch("api.routers.chat_router.agent_executor")
    def test_chat_completion_different_message_roles(
        self, mock_chat_service, test_client: TestClient
    ):
        """Test chat completion with different message roles."""
        mock_response = ChatCompletionResponse(
            id="chatcmpl-test123",
            object="chat.completion",
            created=1234567890,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatCompletionMessage(
                        role="assistant",
                        content="I understand, thank you for the context.",
                    ),
                    finish_reason="stop",
                )
            ],
            usage=Usage(prompt_tokens=25, completion_tokens=10, total_tokens=35),
        )
        mock_chat_service.run_without_streaming.return_value = (
            mock_response.model_dump()
        )

        # Create payload using proper model
        payload_model = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[
                ChatCompletionMessage(
                    role="system", content="You are a helpful assistant."
                ),
                ChatCompletionMessage(role="user", content="What's the weather?"),
                ChatCompletionMessage(
                    role="assistant", content="I don't have access to weather data."
                ),
                ChatCompletionMessage(role="user", content="That's okay, thanks."),
            ],
            stream=False,
        )
        payload = payload_model.model_dump()
        resp = test_client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200

        # Parse response into model
        response = ChatCompletionResponse.model_validate(resp.json())

        # Validate response
        choice = response.choices[0]
        assert choice.index == 0
        assert choice.message.role == "assistant"
        assert choice.message.content
        assert choice.finish_reason

        # Validate usage information
        assert response.usage.prompt_tokens > 0
        assert response.usage.completion_tokens > 0
        assert response.usage.total_tokens > 0
