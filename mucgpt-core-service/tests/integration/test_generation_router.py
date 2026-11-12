from collections.abc import Sequence
from contextlib import nullcontext
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from core.lf_prompts import ResolvedPrompt
from core.llm_helpers import hash_user_id


@pytest.fixture(autouse=True)
def generation_prompts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.routers.generation_router.read_prompt_file_with_metadata",
        lambda filename: ResolvedPrompt(content=f"{filename} instruction"),
    )


@pytest.fixture
def langfuse_root(monkeypatch: pytest.MonkeyPatch):
    client = MagicMock()
    client.create_trace_id.return_value = "a" * 32
    observation = (
        client.start_as_current_observation.return_value.__enter__.return_value
    )
    propagate_attributes = MagicMock(side_effect=lambda **_kwargs: nullcontext())
    monkeypatch.setattr("api.routers.generation_router.get_client", lambda: client)
    monkeypatch.setattr(
        "api.routers.generation_router.propagate_attributes", propagate_attributes
    )
    return client, observation, propagate_attributes


class _FakeConfiguredModel:
    def __init__(
        self,
        response_by_run_name: dict[str, str],
        fail_run_name: str | None = None,
    ) -> None:
        self._response_by_run_name = response_by_run_name
        self._fail_run_name = fail_run_name
        self._run_name = ""
        self.messages: list[Any] = []
        self._capture_owner: _FakeConfiguredModel = self

    def bind(self, **_kwargs: Any) -> "_FakeConfiguredModel":
        return self

    async def ainvoke(self, messages: Sequence[Any], config: Any = None) -> AIMessage:
        run_name = (config or {}).get("run_name") or ""
        self._capture_owner.messages = list(messages)
        if self._fail_run_name and run_name == self._fail_run_name:
            raise RuntimeError("boom")
        return AIMessage(content=self._response_by_run_name.get(run_name, "fallback"))


@pytest.mark.integration
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_assistant_draft_direct_and_parallel(
    mock_get_model, test_client: TestClient, langfuse_root
) -> None:
    responses = {
        "assistant-draft-system-prompt": "System Prompt Text",
        "assistant-draft-description": "Beschreibungssatz",
        "assistant-draft-title": "Titel",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)

    resp = test_client.post(
        "/v1/generations/assistant-draft",
        json={"prompt_seed": "Hilft bei Meeting-Protokollen"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["system_prompt"] == "System Prompt Text"
    assert body["description"] == "Beschreibungssatz"
    assert body["title"] == "Titel"
    assert mock_get_model.call_count == 3
    client, observation, propagate_attributes = langfuse_root
    client.start_as_current_observation.assert_called_once_with(
        name="assistant-draft-generation",
        input="Hilft bei Meeting-Protokollen",
        trace_context={"trace_id": "a" * 32},
    )
    propagate_attributes.assert_called_once_with(
        user_id=hash_user_id("test_user_123"),
        tags=["assistant-draft"],
        trace_name="assistant-draft-generation",
    )
    observation.update.assert_called_once_with(output=body)


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_direct_model(
    mock_get_model, mock_set_title, test_client: TestClient, langfuse_root
) -> None:
    responses = {
        "chat-title-generation": "E-Mail Hilfe",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)
    mock_set_title.return_value = True

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "E-Mail Hilfe"
    assert mock_get_model.call_count == 1
    mock_set_title.assert_awaited_once_with(
        conversation_id="conv-1", user_id="test_user_123", title="E-Mail Hilfe"
    )
    messages = mock_get_model.return_value.messages
    assert len(messages) == 2
    assert messages[0].type == "system"
    assert messages[1].type == "human"
    assert messages[1].content == (
        "Nutzernachricht:\nWie schreibe ich eine Antwort?\n\n"
        "Assistentenantwort:\nHier ist eine Struktur..."
    )
    client, observation, propagate_attributes = langfuse_root
    client.start_as_current_observation.assert_called_once_with(
        name="chat-title-generation",
        input={
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
        },
        trace_context={"trace_id": "a" * 32},
    )
    propagate_attributes.assert_called_once_with(
        user_id=hash_user_id("test_user_123"),
        tags=["chat-title"],
        session_id="conv-1",
        trace_name="chat-title-generation",
    )
    observation.update.assert_called_once_with(output=body)


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_fallback_when_empty(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    responses = {
        "chat-title-generation": "",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)
    mock_set_title.return_value = True

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-2",
            "query": "Bitte um Statusupdate zum Projekt",
            "answer": "Der Status ist gruen.",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Bitte um Statusupdate zum"


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_forbidden_for_foreign_conversation(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    responses = {
        "chat-title-generation": "E-Mail Hilfe",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)
    mock_set_title.return_value = False

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "someone-elses-conv",
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
        },
    )

    assert resp.status_code == 403, resp.text


@pytest.mark.integration
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_assistant_draft_error_mapping(
    mock_get_model, test_client: TestClient
) -> None:
    responses = {
        "assistant-draft-system-prompt": "System Prompt Text",
        "assistant-draft-description": "Beschreibungssatz",
        "assistant-draft-title": "Titel",
    }
    mock_get_model.return_value = _FakeConfiguredModel(
        response_by_run_name=responses,
        fail_run_name="assistant-draft-description",
    )

    resp = test_client.post(
        "/v1/generations/assistant-draft",
        json={"prompt_seed": "Hilft bei Meeting-Protokollen"},
    )

    assert resp.status_code == 500
    detail = resp.json().get("detail", "")
    # Human-readable phrase, no raw exception body, plus the stable error code.
    assert "An unexpected error occurred" in detail
    assert "(unknown)" in detail
    assert "boom" not in detail
