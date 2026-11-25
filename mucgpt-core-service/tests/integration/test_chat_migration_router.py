"""Router tests for the temporary browser chat import endpoint."""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from api.routers.chat_router import CONVERSATION_RUN_LOCK_PREFIX
from chat_migration.service import ImportConflictError

URL = "/v1/conversations/import"
BODY = {
    "conversation_id": "chat-1",
    "title": "Kita Gebühren",
    "last_edited": "2025-03-01T12:00:00Z",
    "turns": [{"user": "q1", "assistant": "a1"}],
}


@pytest.fixture
def import_chat(monkeypatch):
    mock = AsyncMock(return_value="imported")
    monkeypatch.setattr("chat_migration.router.import_chat", mock)
    return mock


def test_new_chat_is_imported(test_client: TestClient, held_run_locks, import_chat):
    response = test_client.post(URL, json=BODY)

    assert response.status_code == 200, response.text
    assert response.json() == {"status": "imported"}
    assert response.headers["cache-control"] == "no-store"
    request, user_id = import_chat.await_args.args
    assert request.conversation_id == "chat-1"
    # owner always comes from the token, never from the payload
    assert user_id == "test_user_123"
    assert held_run_locks == set()


def test_repeat_is_skipped(test_client: TestClient, held_run_locks, import_chat):
    import_chat.return_value = "skipped"

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 200, response.text
    assert response.json() == {"status": "skipped"}


def test_conversation_list_is_not_cacheable(test_client: TestClient, monkeypatch):
    get_conversations = AsyncMock(return_value=[])
    monkeypatch.setattr(
        "api.routers.chat_router.PersistanceHelpers.get_conversations_for_user",
        get_conversations,
    )

    response = test_client.get("/v1/conversations")

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    get_conversations.assert_awaited_once_with("test_user_123")


def test_conflict_returns_409_and_frees_the_lock(
    test_client: TestClient, held_run_locks, import_chat
):
    import_chat.side_effect = ImportConflictError("chat-1")

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 409, response.text
    assert held_run_locks == set()


@pytest.mark.parametrize(
    "turns",
    [[], [{"user": "q1", "assistant": "   "}], [{"user": "", "assistant": "a1"}]],
)
def test_empty_content_is_rejected(
    test_client: TestClient, held_run_locks, import_chat, turns
):
    response = test_client.post(URL, json={**BODY, "turns": turns})

    assert response.status_code == 422, response.text
    import_chat.assert_not_awaited()


def test_busy_chat_returns_409(test_client: TestClient, held_run_locks, import_chat):
    # a chat turn is running on this conversation right now
    held_run_locks.add(f"{CONVERSATION_RUN_LOCK_PREFIX}:chat-1")

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 409, response.text
    import_chat.assert_not_awaited()
