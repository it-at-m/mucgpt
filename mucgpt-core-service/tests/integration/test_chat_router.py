import json
from unittest.mock import AsyncMock, Mock, patch

import pytest
from ag_ui.core.events import EventType, RunErrorEvent
from fastapi.testclient import TestClient
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from api.api_models import ChatCompletionMessage, ChatCompletionRequest
from api.exception import RATE_LIMITED
from config.model_provider import ModelRegistry, ModelsConfigurationException

DUMMY_CONVERSATION_ID = "conv-test-1"


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
