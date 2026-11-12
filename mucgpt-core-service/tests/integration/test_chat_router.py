import json
from unittest.mock import AsyncMock, Mock, patch

import pytest
from ag_ui.core.events import (
    EventType,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
)
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from api.api_models import ChatCompletionMessage, ChatCompletionRequest
from api.exception import RATE_LIMITED
from config.model_provider import ModelRegistry, ModelsConfigurationException

DUMMY_CONVERSATION_ID = "conv-test-1"


def native_run_body(**overrides) -> dict:
    """A minimal valid native AG-UI run input for the v2 endpoint."""
    body = {
        "threadId": DUMMY_CONVERSATION_ID,
        "runId": "run-42",
        "protocolVersion": "1.0",
        "messages": [{"id": "m1", "role": "user", "content": "Hello"}],
        "forwardedProps": {"mucgpt": {"model": "gpt-4o-mini", "persist": False}},
        "state": {},
        "tools": [],
        "context": [],
        "resume": [],
    }
    body.update(overrides)
    return body


@pytest.fixture(autouse=True)
def stub_persistence(monkeypatch: pytest.MonkeyPatch) -> None:
    from core.persistance_helpers import PersistanceHelpers

    monkeypatch.setattr("api.routers.chat_router._save_document_selection", AsyncMock())

    monkeypatch.setattr(
        PersistanceHelpers, "verify_user_in_conversation", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "has_checkpoint", AsyncMock(return_value=False)
    )


@pytest.fixture(autouse=True)
def initialized_model_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    model = FakeListChatModel(responses=["test"])

    def get_model(model_name: str | None = None, **_: object) -> BaseChatModel:
        if model_name in {None, "gpt-4o-mini"}:
            return model
        raise ModelsConfigurationException(
            f"Model {model_name!r} not found in the registry"
        )

    monkeypatch.setattr(ModelRegistry, "get_model", get_model)


class TestChatRouter:
    def test_legacy_chat_endpoint_is_not_available(
        self, test_client: TestClient
    ) -> None:
        response = test_client.post(
            "/v1/chat/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [],
                "conversation_id": DUMMY_CONVERSATION_ID,
            },
        )
        assert response.status_code == 404

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_ag_ui_stream_run_error_carries_code_and_detail(
        self, mock_init_agent: AsyncMock, test_client: TestClient
    ) -> None:
        async def executor_run_error_stream():
            yield RunErrorEvent(
                type=EventType.RUN_ERROR,
                message="exception: openai.RateLimitError\nmessage: Too many",
                code=RATE_LIMITED,
                metadata={
                    "detail": "exception: openai.RateLimitError\nmessage: Too many"
                },
            )

        mock_agent = Mock()
        mock_agent.run_agui_with_streaming.return_value = executor_run_error_stream()
        mock_init_agent.return_value = mock_agent
        payload = ChatCompletionRequest(
            model="gpt-4o-mini",
            messages=[ChatCompletionMessage(role="user", content="hi")],
            conversation_id=DUMMY_CONVERSATION_ID,
            persist=False,
        ).model_dump()

        response = test_client.post("/v1/chat/v2/completions", json=payload)

        assert response.status_code == 200
        events = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        error = next(event for event in events if event.get("type") == "RUN_ERROR")
        assert error["code"] == RATE_LIMITED
        assert error["metadata"]["detail"] == error["message"]

    @pytest.mark.parametrize("stream", [False, True])
    def test_ag_ui_rejects_unknown_model(
        self, test_client: TestClient, stream: bool
    ) -> None:
        payload = ChatCompletionRequest(
            model="invalid-model",
            messages=[ChatCompletionMessage(role="user", content="Hello")],
            stream=stream,
            conversation_id=DUMMY_CONVERSATION_ID,
        ).model_dump()

        response = test_client.post("/v1/chat/v2/completions", json=payload)

        assert response.status_code == 400
        assert response.json() == {
            "detail": "Model 'invalid-model' not found in the registry"
        }

    @pytest.mark.parametrize(
        "body",
        [
            pytest.param(
                ChatCompletionRequest(
                    model="invalid-model",
                    messages=[ChatCompletionMessage(role="user", content="Hello")],
                    conversation_id=DUMMY_CONVERSATION_ID,
                ).model_dump(),
                id="legacy-envelope",
            ),
            pytest.param(native_run_body(), id="native-run-input"),
        ],
    )
    def test_ag_ui_rejects_unknown_model_in_both_shapes(
        self, test_client: TestClient, body: dict
    ) -> None:
        response = test_client.post(
            "/v1/chat/v2/completions",
            json=body
            if "protocolVersion" not in body
            else {
                **body,
                "forwardedProps": {"mucgpt": {"model": "invalid-model"}},
            },
        )

        assert response.status_code == 400
        assert response.json() == {
            "detail": "Model 'invalid-model' not found in the registry"
        }

    @patch("api.routers.chat_router.init_agent", new_callable=AsyncMock)
    def test_native_run_input_streams_and_echoes_input_identity(
        self, mock_init_agent: AsyncMock, test_client: TestClient
    ) -> None:
        async def stream():
            yield RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=DUMMY_CONVERSATION_ID,
                run_id="run-42",
                protocol_version="1.0",
            )
            yield RunFinishedEvent(
                type=EventType.RUN_FINISHED,
                thread_id=DUMMY_CONVERSATION_ID,
                run_id="run-42",
            )

        mock_agent = Mock()
        mock_agent.run_agui_with_streaming.return_value = stream()
        mock_init_agent.return_value = mock_agent

        response = test_client.post(
            "/v1/chat/v2/completions", json=native_run_body()
        )

        assert response.status_code == 200
        events = [
            json.loads(line[6:])
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        started = next(e for e in events if e["type"] == "RUN_STARTED")
        assert started["runId"] == "run-42"
        assert started["protocolVersion"] == "1.0"
        finished = next(e for e in events if e["type"] == "RUN_FINISHED")
        assert finished["runId"] == "run-42"
        # the executor received the input's runId for the boundary events
        assert mock_agent.run_agui_with_streaming.call_args.kwargs["run_id"] == "run-42"

    def test_native_run_input_rejects_foreign_major_line(
        self, test_client: TestClient
    ) -> None:
        response = test_client.post(
            "/v1/chat/v2/completions",
            json=native_run_body(protocolVersion="2.0"),
        )

        assert response.status_code == 400
        assert "major version" in response.json()["detail"]

    def test_image_input_fails_closed_on_non_vision_model(
        self, test_client: TestClient
    ) -> None:
        body = native_run_body()
        body["messages"] = [
            {
                "id": "m1",
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this"},
                    {
                        "type": "image",
                        "source": {
                            "type": "data",
                            "value": "QUJD",
                            "mime_type": "image/png",
                        },
                    },
                ],
            }
        ]

        response = test_client.post("/v1/chat/v2/completions", json=body)

        # The fail-closed vision gate: a deliberate deviation from the AG-UI
        # "MUST NOT fail the run" rule (privacy-policy rejection before the run).
        assert response.status_code == 400
        assert "image input" in response.json()["detail"]
