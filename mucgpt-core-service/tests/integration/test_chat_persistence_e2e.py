"""End-to-end proof that chat persistence + agent-state checkpointing work
with the model endpoint DOWN.

The only LLM is an in-process FakeChatModel and the only datastore is in-memory
SQLite + an in-process MemorySaver. A passing run demonstrates the whole flow
operates with no network:

  A) app-level store: user + assistant turns persisted and reloadable
  B) checkpointer:    graph state persisted per conversation thread and resumable
  + backward-compat:  no conversation_id -> stateless, no rows written
"""

import json

from fastapi.testclient import TestClient

BASE = "/v1/conversations"
CHAT = "/v1/chat/completions"


def _create_conversation(client: TestClient, title: str = "e2e") -> str:
    resp = client.post(BASE, json={"title": title})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_non_streaming_persists_user_and_assistant(test_client_with_fake_model):
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


def test_streaming_persists_assembled_assistant_once(test_client_with_fake_model):
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


def test_without_conversation_id_is_stateless(test_client_with_fake_model):
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


def test_invalid_conversation_id_returns_404(test_client_with_fake_model):
    client = test_client_with_fake_model
    resp = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "conversation_id": "does-not-exist",
        },
    )
    assert resp.status_code == 404


def test_checkpointed_state_persists_and_accumulates(test_client_with_fake_model):
    """Layer B: agent graph state is checkpointed under the conversation thread
    and grows across turns (proving resume-from-checkpoint works offline)."""
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

    state1 = client.get(f"{BASE}/{conv_id}/state").json()
    assert state1["has_checkpoint"] is True
    count_after_turn1 = len(state1["messages"])
    assert count_after_turn1 >= 2  # user + assistant in graph state

    # Turn 2 (same conversation/thread) should build on prior checkpointed state.
    r2 = client.post(
        CHAT,
        json={
            "model": "fake",
            "messages": [{"role": "user", "content": "second turn"}],
            "stream": False,
            "conversation_id": conv_id,
        },
    )
    assert r2.status_code == 200, r2.text

    state2 = client.get(f"{BASE}/{conv_id}/state").json()
    assert len(state2["messages"]) > count_after_turn1
