"""Real PostgreSQL HTTP coverage for the persisted chat lifecycle."""

import os
from collections.abc import Sequence
from uuid import uuid4

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from tests.fakes.scripted_chat_model import text
from tests.integration.postgres_http_harness import (
    PostgresHttpHarness,
    final_text,
    postgres_http_harness,
)

from core.persistance_helpers import PersistanceHelpers

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


def _browser_history(*turns: tuple[str, str], prompt: str) -> list[dict[str, str]]:
    """Build the full history a browser resubmits for a persisted continuation."""
    messages = [
        message
        for user_content, assistant_content in turns
        for message in (
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        )
    ]
    return [*messages, {"role": "user", "content": prompt}]


def _persisted_body(
    harness: PostgresHttpHarness,
    conversation_id: str,
    messages: Sequence[dict[str, str]],
) -> dict[str, object]:
    """Use the harness defaults while retaining a browser-style message history."""
    return harness.persisted_chat_body("unused", conversation_id=conversation_id) | {
        "messages": list(messages)
    }


async def _persistence_counts(
    harness: PostgresHttpHarness, conversation_id: str
) -> dict[str, int]:
    """Return physical rows for one conversation across metadata and checkpoints."""
    conninfo = make_conninfo(
        **harness.database.connection_args, dbname=harness.database.name
    )
    async with await psycopg.AsyncConnection.connect(conninfo, autocommit=True) as conn:
        counts: dict[str, int] = {}
        for table in ("chats", "checkpoints", "checkpoint_writes", "checkpoint_blobs"):
            result = await conn.execute(
                f"SELECT count(*) FROM {table} WHERE conversation_id = %s"
                if table == "chats"
                else f"SELECT count(*) FROM {table} WHERE thread_id = %s",
                (conversation_id,),
            )
            row = await result.fetchone()
            assert row is not None
            counts[table] = row[0]
        return counts


@pytest.mark.asyncio
async def test_persisted_chat_http_lifecycle_survives_restart_and_deletion(
    monkeypatch,
) -> None:
    """Persisted AG-UI turns reconstruct once, survive restart, and retire on delete."""
    async with postgres_http_harness(monkeypatch) as harness:
        conversation_id = f"chat-lifecycle-{uuid4()}"
        harness.set_model_script(
            [
                text("First deterministic answer"),
                text("Second deterministic answer"),
                text("Third deterministic answer"),
                text("Stateless deterministic answer"),
            ]
        )

        first_events = await harness.chat_events(
            _persisted_body(
                harness,
                conversation_id,
                [{"role": "user", "content": "First question"}],
            )
        )
        assert final_text(first_events) == "First deterministic answer"

        second_events = await harness.chat_events(
            _persisted_body(
                harness,
                conversation_id,
                _browser_history(
                    ("First question", "First deterministic answer"),
                    prompt="Second question",
                ),
            )
        )
        assert final_text(second_events) == "Second deterministic answer"

        conversations = await harness.client.get("/v1/conversations")
        assert conversations.status_code == 200
        conversation_metadata = conversations.json()
        assert [
            conversation["conversation_id"] for conversation in conversation_metadata
        ] == [conversation_id]

        messages = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert messages.status_code == 200
        assert [message["role"] for message in messages.json()] == [
            "user",
            "assistant",
            "user",
            "assistant",
        ]
        assert [message["content"] for message in messages.json()] == [
            "First question",
            "First deterministic answer",
            "Second question",
            "Second deterministic answer",
        ]

        with harness.as_user(harness.foreign_user) as foreign_harness:
            foreign_messages = await foreign_harness.client.get(
                f"/v1/conversations/{conversation_id}/messages"
            )
            assert foreign_messages.status_code == 403

        await PersistanceHelpers.close()
        await PersistanceHelpers.init(harness.database.settings)

        conversations_after_restart = await harness.client.get("/v1/conversations")
        assert conversations_after_restart.status_code == 200
        assert conversations_after_restart.json() == conversation_metadata

        stored_messages = await PersistanceHelpers.get_conversation_messages(
            conversation_id
        )
        assert [message.role for message in stored_messages] == [
            "user",
            "assistant",
            "user",
            "assistant",
        ]
        assert [message.content for message in stored_messages] == [
            "First question",
            "First deterministic answer",
            "Second question",
            "Second deterministic answer",
        ]

        third_events = await harness.chat_events(
            _persisted_body(
                harness,
                conversation_id,
                _browser_history(
                    ("First question", "First deterministic answer"),
                    ("Second question", "Second deterministic answer"),
                    prompt="Third question",
                ),
            )
        )
        assert final_text(third_events) == "Third deterministic answer"

        messages_after_restart = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert messages_after_restart.status_code == 200
        assert [message["content"] for message in messages_after_restart.json()] == [
            "First question",
            "First deterministic answer",
            "Second question",
            "Second deterministic answer",
            "Third question",
            "Third deterministic answer",
        ]

        stateless_conversation_id = f"stateless-{uuid4()}"
        stateless_events = await harness.chat_events(
            {
                **harness.persisted_chat_body(
                    "A stateless question", conversation_id=stateless_conversation_id
                ),
                "persist": False,
            }
        )
        assert final_text(stateless_events) == "Stateless deterministic answer"
        assert await _persistence_counts(harness, stateless_conversation_id) == {
            "chats": 0,
            "checkpoints": 0,
            "checkpoint_writes": 0,
            "checkpoint_blobs": 0,
        }

        deleted = await harness.client.delete(f"/v1/conversations/{conversation_id}")
        assert deleted.status_code == 204
        assert await _persistence_counts(harness, conversation_id) == {
            "chats": 1,
            "checkpoints": 0,
            "checkpoint_writes": 0,
            "checkpoint_blobs": 0,
        }
        assert (await harness.client.get("/v1/conversations")).json() == []

        retired_messages = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert retired_messages.status_code == 403
        revival = await harness.client.post(
            "/v1/chat/v2/completions",
            json=_persisted_body(
                harness,
                conversation_id,
                [{"role": "user", "content": "Attempted revival"}],
            ),
        )
        assert revival.status_code == 403
        harness.assert_model_consumed()
