"""Router tests for the temporary browser chat import endpoint."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from api.routers.chat_router import CONVERSATION_RUN_LOCK_PREFIX
from chat_migration import router as chat_migration_router
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


def test_busy_chat_returns_423_with_retry_after(
    test_client: TestClient, held_run_locks, import_chat
):
    # a chat turn is running on this conversation right now
    held_run_locks.add(f"{CONVERSATION_RUN_LOCK_PREFIX}:chat-1")

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 423, response.text
    assert response.headers["retry-after"] == "5"
    import_chat.assert_not_awaited()


def test_import_capacity_returns_429(test_client: TestClient, monkeypatch, import_chat):
    monkeypatch.setattr(
        "chat_migration.router._acquire_import_slot", AsyncMock(return_value=None)
    )

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 429, response.text
    assert response.headers["retry-after"] == "5"
    import_chat.assert_not_awaited()


def test_import_capacity_frees_the_conversation_lock(
    test_client: TestClient, held_run_locks, monkeypatch, import_chat
):
    monkeypatch.setattr(
        "chat_migration.router._acquire_import_slot", AsyncMock(return_value=None)
    )

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 429, response.text
    assert held_run_locks == set()


def test_lost_import_slot_lease_cancels_the_import(
    test_client: TestClient, monkeypatch, import_chat
):
    cancelled = False

    async def stalled_import(*_args):
        nonlocal cancelled
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled = True
            raise

    monkeypatch.setattr(
        "chat_migration.router._renew_import_slot", AsyncMock(return_value=False)
    )
    import_chat.side_effect = stalled_import

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 503, response.text
    assert response.headers["retry-after"] == "5"
    assert cancelled


def test_busy_chat_does_not_take_an_import_slot(
    test_client: TestClient, held_run_locks, monkeypatch, import_chat
):
    acquire_slot = AsyncMock()
    monkeypatch.setattr("chat_migration.router._acquire_import_slot", acquire_slot)
    held_run_locks.add(f"{CONVERSATION_RUN_LOCK_PREFIX}:chat-1")

    response = test_client.post(URL, json=BODY)

    assert response.status_code == 423, response.text
    acquire_slot.assert_not_awaited()


@pytest.mark.asyncio
async def test_import_slot_renewal_extends_the_lease(monkeypatch):
    slot = AsyncMock()
    stop = asyncio.Event()

    async def extend(*_args, **_kwargs):
        stop.set()
        return True

    slot.extend.side_effect = extend
    monkeypatch.setattr("chat_migration.router.asyncio.sleep", AsyncMock())

    await chat_migration_router._renew_import_slot(slot, 60, stop)

    slot.extend.assert_awaited_once_with(60, replace_ttl=True)


@pytest.mark.asyncio
async def test_import_slot_renewal_reports_a_lost_lease(monkeypatch):
    slot = AsyncMock()
    slot.extend.return_value = False
    monkeypatch.setattr("chat_migration.router.asyncio.sleep", AsyncMock())

    renewed = await chat_migration_router._renew_import_slot(slot, 60, asyncio.Event())

    assert not renewed
