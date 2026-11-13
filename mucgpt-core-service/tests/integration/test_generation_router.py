from collections.abc import Sequence
from contextlib import nullcontext
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from api.routers.generation_router import _TITLE_MESSAGE_LIMIT
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
        response_by_run_name: dict[str, str] | None = None,
        fail_run_name: str | None = None,
        structured_response_by_run_name: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        self._response_by_run_name = response_by_run_name or {}
        self._fail_run_name = fail_run_name
        self._structured_response_by_run_name = structured_response_by_run_name or {}
        self._schema: Any = None
        self._run_name = ""
        self.messages: list[Any] = []
        self._capture_owner: _FakeConfiguredModel = self

    def bind(self, **_kwargs: Any) -> "_FakeConfiguredModel":
        return self

    def with_structured_output(self, schema: Any) -> "_FakeStructuredModel":
        return _FakeStructuredModel(self, schema)

    async def ainvoke(self, messages: Sequence[Any], config: Any = None) -> AIMessage:
        run_name = (config or {}).get("run_name") or ""
        self._capture_owner.messages = list(messages)
        if self._fail_run_name and run_name == self._fail_run_name:
            raise RuntimeError("boom")
        return AIMessage(content=self._response_by_run_name.get(run_name, "fallback"))


class _FakeStructuredModel:
    """Structured-output wrapper mimicking `with_structured_output(...).bind()`."""

    def __init__(self, owner: _FakeConfiguredModel, schema: Any) -> None:
        self._owner = owner
        self._schema = schema

    def bind(self, **_kwargs: Any) -> "_FakeStructuredModel":
        return self

    async def ainvoke(self, messages: Sequence[Any], config: Any = None) -> Any:
        run_name = (config or {}).get("run_name") or ""
        self._owner.messages = list(messages)
        if self._owner._fail_run_name and run_name == self._owner._fail_run_name:
            raise RuntimeError("boom")
        raw = self._owner._structured_response_by_run_name.get(run_name)
        if raw is None:
            raise RuntimeError(f"No structured response configured for {run_name!r}")
        return self._schema(**raw)


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
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {"decision": "new_title", "title": "E-Mail Hilfe"}
        }
    )
    mock_set_title.return_value = True

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
            "language": "de",
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
        "User message:\nWie schreibe ich eine Antwort?\n\n"
        "Assistant answer:\nHier ist eine Struktur...\n\n"
        'Title language:\nWrite the chat title in the language with ISO 639 code "de".'
    )
    client, observation, propagate_attributes = langfuse_root
    client.start_as_current_observation.assert_called_once_with(
        name="chat-title-generation",
        input={
            "query": "Wie schreibe ich eine Antwort?",
            "answer": "Hier ist eine Struktur...",
            "current_title": None,
            "previous_turns": None,
            "language": "de",
        },
        trace_context={"trace_id": "a" * 32},
    )
    propagate_attributes.assert_called_once_with(
        user_id=hash_user_id("test_user_123"),
        tags=["chat-title"],
        session_id="conv-1",
        trace_name="chat-title-generation",
    )
    observation.update.assert_called_once_with(
        output={**body, "decision": "new_title"}
    )


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_fallback_when_empty(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {"decision": "new_title", "title": ""}
        }
    )
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
def test_generate_chat_title_regeneration_with_current_title_and_turns(
    mock_get_model, mock_set_title, test_client: TestClient, langfuse_root
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {
                "decision": "new_title",
                "title": "Projektstatus",
            }
        }
    )
    mock_set_title.return_value = True

    long_query = "x" * (_TITLE_MESSAGE_LIMIT + 100)
    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Jetzt noch zum Budget",
            "answer": "Das Budget ist genehmigt.",
            "current_title": "E-Mail Hilfe",
            "system_message": "Du bist ein Assistent für Verwaltungsarbeit.",
            "language": "de",
            "previous_turns": [
                {
                    "query": "Erste Frage vor dem Drift",
                    "answer": "Erste Antwort",
                },
                {
                    "query": "Zweite Frage vor dem Drift",
                    "answer": "Zweite Antwort",
                },
                {"query": long_query, "answer": "Dritte Antwort"},
            ],
        },
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "Projektstatus"
    messages = mock_get_model.return_value.messages
    assert len(messages) == 2
    content = messages[1].content
    # Only the last 2 previous turns are kept (oldest dropped).
    assert "Erste Frage vor dem Drift" not in content
    assert "Zweite Frage vor dem Drift" in content
    assert "Dritte Antwort" in content
    # Current turn comes last (before the language section).
    assert (
        "User message:\nJetzt noch zum Budget\n\n"
        "Assistant answer:\nDas Budget ist genehmigt.\n\n"
        'Title language:\nWrite the chat title in the language with ISO 639 code "de".'
    ) in content
    # Current title and keep-or-rename instruction are included.
    assert "Current chat title:\nE-Mail Hilfe" in content
    assert 'Return decision "keep_title"' in content
    # System prompt section is included.
    assert content.startswith(
        "System prompt:\nDu bist ein Assistent für Verwaltungsarbeit."
    )
    # Overlong messages are truncated.
    assert long_query not in content
    assert "x" * _TITLE_MESSAGE_LIMIT + " …" in content
    client, observation, _ = langfuse_root
    client.start_as_current_observation.assert_called_once_with(
        name="chat-title-generation",
        input={
            "query": "Jetzt noch zum Budget",
            "answer": "Das Budget ist genehmigt.",
            "current_title": "E-Mail Hilfe",
            "previous_turns": [
                {"query": "Erste Frage vor dem Drift", "answer": "Erste Antwort"},
                {"query": "Zweite Frage vor dem Drift", "answer": "Zweite Antwort"},
                {"query": long_query, "answer": "Dritte Antwort"},
            ],
            "language": "de",
        },
        trace_context={"trace_id": "a" * 32},
    )


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_without_current_title_has_no_rename_instruction(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {"decision": "new_title", "title": "E-Mail Hilfe"}
        }
    )
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
    content = mock_get_model.return_value.messages[1].content
    assert "Current chat title" not in content
    assert "keep_title" not in content


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_keep_title_skips_persistence(
    mock_get_model, mock_set_title, test_client: TestClient, langfuse_root
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {"decision": "keep_title", "title": None}
        }
    )

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Jetzt noch zum Budget",
            "answer": "Das Budget ist genehmigt.",
            "current_title": "E-Mail Hilfe",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "E-Mail Hilfe"
    # The title is unchanged: nothing is written server-side.
    mock_set_title.assert_not_called()
    _, observation, _ = langfuse_root
    observation.update.assert_called_once_with(
        output={**body, "decision": "keep_title"}
    )


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_falls_back_to_current_title_on_structured_failure(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    # No structured response configured -> ainvoke raises -> keep current title.
    mock_get_model.return_value = _FakeConfiguredModel()

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Jetzt noch zum Budget",
            "answer": "Das Budget ist genehmigt.",
            "current_title": "E-Mail Hilfe",
        },
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "E-Mail Hilfe"
    mock_set_title.assert_not_called()


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_falls_back_to_query_on_initial_structured_failure(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel()
    mock_set_title.return_value = True

    resp = test_client.post(
        "/v1/generations/chat-title",
        json={
            "conversation_id": "conv-1",
            "query": "Bitte um Statusupdate zum Projekt",
            "answer": "Der Status ist gruen.",
        },
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "Bitte um Statusupdate zum"
    mock_set_title.assert_awaited_once()


@pytest.mark.integration
@patch(
    "api.routers.generation_router.PersistanceHelpers.set_chat_title_for_conversation",
    new_callable=AsyncMock,
)
@patch("core.llm_helpers.ModelRegistry.get_model")
def test_generate_chat_title_forbidden_for_foreign_conversation(
    mock_get_model, mock_set_title, test_client: TestClient
) -> None:
    mock_get_model.return_value = _FakeConfiguredModel(
        structured_response_by_run_name={
            "chat-title-generation": {"decision": "new_title", "title": "E-Mail Hilfe"}
        }
    )
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
