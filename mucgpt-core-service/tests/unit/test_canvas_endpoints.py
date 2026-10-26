import logging
from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from api.api_models import CANVAS_CONTENT_MAX_CHARS
from api.routers.chat_router import router as chat_router
from config.model_provider import ModelRegistry, ModelsConfigurationException
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.persistance_helpers import PersistanceHelpers

USER_ID = "test_user_123"
CONVERSATION_ID = "conv-test-1"


def _fake_agent() -> Mock:
    from api.api_models import (
        ChatCompletionChoice,
        ChatCompletionMessage,
        ChatCompletionResponse,
        Usage,
    )

    agent = Mock()
    agent.run_without_streaming = AsyncMock(
        return_value=ChatCompletionResponse(
            id="chatcmpl-test",
            object="chat.completion",
            created=1,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatCompletionMessage(role="assistant", content="Hi"),
                    finish_reason="stop",
                )
            ],
            usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        )
    )
    return agent


@pytest.fixture(autouse=True)
def initialized_model_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    model = FakeListChatModel(responses=["ok"])

    def get_model(
        model_name: str | None = None,
        logger: logging.Logger | None = None,
    ) -> FakeListChatModel:
        if model_name in {None, "gpt-4o-mini"}:
            return model
        raise ModelsConfigurationException(
            f"Model {model_name!r} not found in the registry"
        )

    monkeypatch.setattr(ModelRegistry, "get_model", get_model)


@pytest.fixture
def test_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    app = FastAPI()
    app.include_router(chat_router)

    async def _get_test_user() -> AuthenticationResult:
        return AuthenticationResult(
            token="dummy_access_token",
            user_id=USER_ID,
            name="Test User",
            email="test@example.com",
            department="IT-Test-Department",
            is_authenticated=True,
        )

    app.dependency_overrides[authenticate_user] = _get_test_user

    monkeypatch.setattr(
        PersistanceHelpers, "conversation_exists", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "is_user_in_conversation", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers,
        "get_canvas",
        AsyncMock(
            return_value=Mock(
                content="# Title", updated_at=datetime(2026, 1, 1, tzinfo=UTC)
            )
        ),
    )
    monkeypatch.setattr(
        PersistanceHelpers, "upsert_canvas", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        PersistanceHelpers,
        "get_canvas_revisions",
        AsyncMock(return_value={"auto": [], "manual": []}),
    )
    monkeypatch.setattr(
        PersistanceHelpers, "upsert_canvas_revisions", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "erase_conversation", AsyncMock(return_value="deleted")
    )
    monkeypatch.setattr(
        PersistanceHelpers, "verify_user_in_conversation", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        PersistanceHelpers, "has_checkpoint", AsyncMock(return_value=False)
    )
    monkeypatch.setattr(
        PersistanceHelpers,
        "get_checkpointer_if_ready",
        Mock(return_value=Mock(adelete_thread=AsyncMock())),
    )
    monkeypatch.setattr(
        "api.routers.chat_router.init_agent", AsyncMock(return_value=_fake_agent())
    )

    return TestClient(app)


@pytest.mark.unit
class TestCanvasEndpoints:
    def test_get_canvas_returns_content(self, test_client: TestClient) -> None:
        response = test_client.get(f"/v1/conversations/{CONVERSATION_ID}/canvas")

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["content"] == "# Title"
        assert body["updated_at"].startswith("2026-01-01")

    def test_get_canvas_of_foreign_conversation_is_forbidden(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers,
            "is_user_in_conversation",
            AsyncMock(return_value=False),
        )

        response = test_client.get(f"/v1/conversations/{CONVERSATION_ID}/canvas")

        assert response.status_code == 403

    def test_get_canvas_of_missing_conversation_is_not_found(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers,
            "conversation_exists",
            AsyncMock(return_value=False),
        )

        response = test_client.get(f"/v1/conversations/{CONVERSATION_ID}/canvas")

        assert response.status_code == 404

    def test_get_canvas_without_canvas_row_is_not_found(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers, "get_canvas", AsyncMock(return_value=None)
        )

        response = test_client.get(f"/v1/conversations/{CONVERSATION_ID}/canvas")

        assert response.status_code == 404

    def test_get_canvas_revisions_returns_rings(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        rings = {"auto": [{"revision": 1}], "manual": []}
        monkeypatch.setattr(
            PersistanceHelpers, "get_canvas_revisions", AsyncMock(return_value=rings)
        )

        response = test_client.get(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions"
        )

        assert response.status_code == 200, response.text
        assert response.json() == rings

    def test_get_canvas_revisions_without_row_is_not_found(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers, "get_canvas_revisions", AsyncMock(return_value=None)
        )

        response = test_client.get(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions"
        )

        assert response.status_code == 404

    def test_get_canvas_revisions_of_foreign_conversation_is_forbidden(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers,
            "is_user_in_conversation",
            AsyncMock(return_value=False),
        )

        response = test_client.get(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions"
        )

        assert response.status_code == 403

    def test_put_canvas_revisions_overwrites(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas_revisions", upsert_mock)
        rings = {
            "auto": [
                {
                    "revision": 2,
                    "doc_json": {},
                    "timestamp": 1,
                    "source": "manual",
                }
            ],
            "manual": [],
        }

        response = test_client.put(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions", json=rings
        )

        assert response.status_code == 204, response.text
        upsert_mock.assert_awaited_once_with(CONVERSATION_ID, rings)

    def test_put_canvas_revisions_rejects_payloads_above_512_kb(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas_revisions", upsert_mock)
        oversized = {"auto": [{"blob": "x" * (512 * 1024)}], "manual": []}

        response = test_client.put(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions", json=oversized
        )

        assert response.status_code == 413, response.text
        upsert_mock.assert_not_awaited()

    def test_put_canvas_revisions_accepts_payloads_at_512_kb(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The limit is exclusive: exactly 512 KB of JSON body passes."""
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas_revisions", upsert_mock)
        # {"blob": "<524000 x>"} serializes to exactly 512*1024 bytes:
        # len('{"auto": [{"blob": ""}], "manual": []}') + 524000 = 524288.
        filler = 512 * 1024 - len('{"auto": [{"blob": ""}], "manual": []}')
        at_limit = {"auto": [{"blob": "x" * filler}], "manual": []}

        response = test_client.put(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions", json=at_limit
        )

        assert response.status_code == 204, response.text
        upsert_mock.assert_awaited_once()

    def test_put_canvas_revisions_of_foreign_conversation_is_forbidden(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers,
            "is_user_in_conversation",
            AsyncMock(return_value=False),
        )

        response = test_client.put(
            f"/v1/conversations/{CONVERSATION_ID}/canvas/revisions",
            json={"auto": [], "manual": []},
        )

        assert response.status_code == 403


    def test_delete_conversation_canvas_failure_returns_500(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            PersistanceHelpers,
            "erase_conversation",
            AsyncMock(side_effect=RuntimeError("db down")),
        )

        response = test_client.delete(f"/v1/conversations/{CONVERSATION_ID}")

        assert response.status_code == 500, response.text

    def test_persisted_chat_upserts_canvas_content(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas", upsert_mock)
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": False,
            "conversation_id": CONVERSATION_ID,
            "canvas": {"content": "# Canvas", "selection": None},
        }

        response = test_client.post("/v1/chat/completions", json=payload)

        assert response.status_code == 200, response.text
        upsert_mock.assert_awaited_once_with(CONVERSATION_ID, "# Canvas")

    def test_persisted_chat_rejects_oversized_canvas(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas", upsert_mock)
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": False,
            "conversation_id": CONVERSATION_ID,
            "canvas": {
                "content": "x" * (CANVAS_CONTENT_MAX_CHARS + 1),
                "selection": None,
            },
        }

        response = test_client.post("/v1/chat/completions", json=payload)

        assert response.status_code == 422, response.text
        upsert_mock.assert_not_awaited()

    def test_stateless_chat_does_not_upsert_canvas(
        self, test_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        upsert_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(PersistanceHelpers, "upsert_canvas", upsert_mock)
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": False,
            "conversation_id": CONVERSATION_ID,
            "persist": False,
            "canvas": {"content": "# Canvas", "selection": None},
        }

        response = test_client.post("/v1/chat/completions", json=payload)

        assert response.status_code == 200, response.text
        upsert_mock.assert_not_awaited()
