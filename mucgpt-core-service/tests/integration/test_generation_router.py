from collections.abc import Sequence
from typing import Any
from unittest.mock import patch

import pytest
from langchain_core.messages import AIMessage


class _FakeConfiguredModel:
    def __init__(
        self,
        response_by_run_name: dict[str, str],
        fail_run_name: str | None = None,
    ) -> None:
        self._response_by_run_name = response_by_run_name
        self._fail_run_name = fail_run_name
        self._run_name = ""

    def with_config(self, config: Any) -> "_FakeConfiguredModel":
        configured = _FakeConfiguredModel(
            response_by_run_name=self._response_by_run_name.copy(),
            fail_run_name=self._fail_run_name,
        )
        configured._run_name = config.get("run_name") or ""
        return configured

    async def ainvoke(self, messages: Sequence[Any]) -> AIMessage:
        if self._fail_run_name and self._run_name == self._fail_run_name:
            raise RuntimeError("boom")
        return AIMessage(
            content=self._response_by_run_name.get(self._run_name, "fallback")
        )


@pytest.mark.integration
@patch("api.routers.generation_router.ModelProvider.get_model")
def test_generate_assistant_draft_direct_and_parallel(mock_get_model, test_client):
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


@pytest.mark.integration
@patch("api.routers.generation_router.ModelProvider.get_model")
def test_generate_chat_title_direct_model(mock_get_model, test_client):
    responses = {
        "chat-title-generation": "E-Mail Hilfe",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "E-Mail Hilfe"
    assert mock_get_model.call_count == 1


@pytest.mark.integration
@patch("api.routers.generation_router.ModelProvider.get_model")
def test_generate_chat_title_fallback_when_empty(mock_get_model, test_client):
    responses = {
        "chat-title-generation": "",
    }
    mock_get_model.return_value = _FakeConfiguredModel(response_by_run_name=responses)

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "query": "Bitte um Statusupdate zum Projekt",
            "answer": "Der Status ist gruen.",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Bitte um Statusupdate zum"


@pytest.mark.integration
@patch("api.routers.generation_router.ModelProvider.get_model")
def test_generate_assistant_draft_error_mapping(mock_get_model, test_client):
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
    assert "Fehler" in detail or "Ein Fehler" in detail
