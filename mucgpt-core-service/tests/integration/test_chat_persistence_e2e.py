"""End-to-end proof that chat persistence works with the model endpoint DOWN.

The only LLM is an in-process FakeChatModel and the only datastore is in-memory
SQLite. A passing run demonstrates the whole flow operates with no network:

  A) request-authoritative store: the client owns the conversation; each turn
     the durable copy is synced to the request history and the assistant turn
     is appended, so the stored conversation reloads and grows/shrinks with the
     client (client-side rollback/regenerate are mirrored for free).
  B) auto-create:     an unknown conversation_id is created on first use.
  + backward-compat:  no conversation_id -> stateless, no rows written.

The LangGraph checkpointer is intentionally NOT engaged by the chat flow (it is
reserved for a future resume feature), so normal turns write no checkpoint.
"""

import json

from fastapi.testclient import TestClient

BASE = "/v1/conversations"
CHAT = "/v1/chat/completions"


def _create_conversation(client: TestClient, title: str = "e2e") -> str:
    resp = client.post(BASE, json={"title": title})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_non_streaming_persists_user_and_assistant(test_client_with_fake_model: TestClient) -> None:
    client = test_client_with_fake_model
    conv_id = _create_conversation(client)

    resp = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "Hi there"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["choices"][0]["message"]["content"]

    detail = client.get(f"{BASE}/{conv_id}").json()
    roles = [(m["role"], m["content"]) for m in detail["messages"]]
    assert roles[0] == ("user", "Hi there")
    assert roles[1][0] == "assistant"
    assert roles[1][1]  # non-empty assistant content
    assert len(roles) == 2


def test_streaming_persists_assembled_assistant_once(test_client_with_fake_model: TestClient) -> None:
    client = test_client_with_fake_model
    conv_id = _create_conversation(client)

    with client.stream(
        "POST",
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "Stream please"}],
            "stream": True,
            "conversation_id": conv_id,
        },
    ) as resp:
        assert resp.status_code == 200, resp.text
        streamed = []
        for line in resp.iter_lines():
            if not line:
                continue
            payload = line[len("data: ") :] if line.startswith("data: ") else line
            chunk = json.loads(payload)
            delta = chunk["choices"][0]["delta"].get("content")
            if delta:
                streamed.append(delta)
    assembled = "".join(streamed)
    assert assembled  # the fake model produced streamed content

    detail = client.get(f"{BASE}/{conv_id}").json()
    assistant_msgs = [m for m in detail["messages"] if m["role"] == "assistant"]
    # Exactly one assistant message persisted, equal to the assembled stream.
    assert len(assistant_msgs) == 1
    assert assistant_msgs[0]["content"] == assembled


def test_without_conversation_id_is_stateless(test_client_with_fake_model: TestClient) -> None:
    client = test_client_with_fake_model

    resp = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "no persistence"}],
            "stream": False,
        },
    )
    assert resp.status_code == 200, resp.text
    # No conversation was created as a side effect.
    assert client.get(BASE).json() == []


def test_unknown_conversation_id_is_auto_created(test_client_with_fake_model: TestClient) -> None:
    """A client-supplied conversation_id that does not exist yet is created on
    first use (the id is the client-generated UUID), so chats persist without a
    separate create call."""
    client = test_client_with_fake_model
    new_id = "client-generated-id-123"

    resp = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "conversation_id": new_id,
        },
    )
    assert resp.status_code == 200, resp.text

    detail = client.get(f"{BASE}/{new_id}")
    assert detail.status_code == 200, detail.text
    roles = [(m["role"], m["content"]) for m in detail.json()["messages"]]
    assert roles[0] == ("user", "hi")
    assert roles[1][0] == "assistant"
    assert len(roles) == 2


def test_history_syncs_and_accumulates_in_db(test_client_with_fake_model: TestClient) -> None:
    """Request-authoritative store: the client resends its full history each
    turn; the durable copy is synced to it and the assistant turn appended, so
    the stored conversation grows across turns."""
    client = test_client_with_fake_model
    conv_id = _create_conversation(client)

    # Turn 1
    r1 = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "first turn"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    assert r1.status_code == 200, r1.text
    detail1 = client.get(f"{BASE}/{conv_id}").json()
    assert len(detail1["messages"]) == 2  # user + assistant
    assistant1 = detail1["messages"][1]["content"]

    # Turn 2: client resends full history + the new turn.
    r2 = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [
                {"role": "user", "content": "first turn"},
                {"role": "assistant", "content": assistant1},
                {"role": "user", "content": "second turn"},
            ],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    assert r2.status_code == 200, r2.text

    roles = [(m["role"], m["content"]) for m in client.get(f"{BASE}/{conv_id}").json()["messages"]]
    assert [r for r, _ in roles] == ["user", "assistant", "user", "assistant"]
    assert roles[0] == ("user", "first turn")
    assert roles[2] == ("user", "second turn")


def test_history_sync_mirrors_client_truncation(test_client_with_fake_model: TestClient) -> None:
    """Client-side rollback/regenerate shrink the history the client resends;
    the durable store mirrors that truncation with no stale trailing turns
    (this is what request-authoritative buys us for free)."""
    client = test_client_with_fake_model
    conv_id = _create_conversation(client)

    # Build two turns.
    client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "u1"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    a1 = client.get(f"{BASE}/{conv_id}").json()["messages"][1]["content"]
    client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [
                {"role": "user", "content": "u1"},
                {"role": "assistant", "content": a1},
                {"role": "user", "content": "u2"},
            ],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    assert len(client.get(f"{BASE}/{conv_id}").json()["messages"]) == 4

    # Client rolls back to u1 and regenerates: it resends only u1.
    client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "u1"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    roles = [(m["role"], m["content"]) for m in client.get(f"{BASE}/{conv_id}").json()["messages"]]
    assert [r for r, _ in roles] == ["user", "assistant"]
    assert roles[0] == ("user", "u1")


def test_chat_flow_does_not_engage_checkpointer(test_client_with_fake_model: TestClient) -> None:
    """The chat flow is request-authoritative; the checkpointer is intentionally
    left disengaged (reserved for a future resume feature), so a normal turn
    writes no checkpoint for the conversation thread."""
    client = test_client_with_fake_model
    conv_id = _create_conversation(client)

    client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )

    state = client.get(f"{BASE}/{conv_id}/state").json()
    assert state["has_checkpoint"] is False
