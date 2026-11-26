"""Real PostgreSQL coverage for document attachments in persisted chats."""

import asyncio
import os
from collections.abc import Sequence
from uuid import UUID, uuid4

import psycopg
import pytest
from langchain_core.messages import ToolMessage
from psycopg.conninfo import make_conninfo
from tests.fakes.scripted_chat_model import read_file, text
from tests.integration.postgres_http_harness import (
    PostgresHttpHarness,
    final_text,
    postgres_http_harness,
)

from core.persistance_helpers import PersistanceHelpers
from core.virtual_file_system_helper import (
    FileStoreManager,
    get_document_namespace,
    get_document_path,
    get_document_storage_key,
)
from database.document_catalog import DocumentCatalogManager

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


def _browser_history(*turns: tuple[str, str], prompt: str) -> list[dict[str, str]]:
    """Build the full history a browser sends for a persisted continuation."""
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
    document_ids: list[str],
) -> dict[str, object]:
    """Build a browser-style persisted request with an explicit attachment list."""
    return harness.persisted_chat_body("unused", conversation_id=conversation_id) | {
        "messages": list(messages),
        "document_ids": document_ids,
    }


async def _persistence_counts(
    harness: PostgresHttpHarness, conversation_id: str
) -> dict[str, int]:
    """Return durable conversation rows so rejected requests prove no side effect."""
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


def _read_result(model: object, tool_call_id: str) -> ToolMessage:
    """Find the real filesystem result passed back to the scripted model."""
    recorded_inputs = getattr(model, "recorded_inputs")
    for call in recorded_inputs[1:]:
        for message in call.messages:
            if (
                isinstance(message, ToolMessage)
                and message.tool_call_id == tool_call_id
            ):
                return message
    raise AssertionError(f"Missing tool result for {tool_call_id}")


@pytest.mark.asyncio
async def test_uploaded_attachment_is_read_immediately_and_remains_safe_through_lifecycle(
    monkeypatch,
) -> None:
    """Read a newly uploaded attachment without reload, restart safely, then reject it after deletion."""
    async with postgres_http_harness(monkeypatch) as harness:
        extracted_text = "Council decision\nImmediate durable attachment detail"
        harness.parser.text = extracted_text
        uploaded = await harness.upload_document("council-decision.txt", b"source")

        assert uploaded.status_code == 201
        document_id = str(UUID(uploaded.json()["id"]))
        document_path = get_document_path(document_id)
        stored_document = await FileStoreManager.get_store().aget(
            get_document_namespace(harness.owner.user_id),
            get_document_storage_key(document_id),
        )
        assert stored_document is not None
        assert stored_document.value["content"] == extracted_text

        # A different user's document must be rejected before a conversation or
        # checkpoint can be created for the owner.
        harness.parser.text = "Foreign confidential attachment"
        with harness.as_user(harness.foreign_user) as foreign_harness:
            foreign_upload = await foreign_harness.upload_document("foreign.txt", b"x")
        assert foreign_upload.status_code == 201
        foreign_document_id = str(UUID(foreign_upload.json()["id"]))
        foreign_conversation_id = f"foreign-attachment-{uuid4()}"
        rejected_foreign = await harness.client.post(
            "/v1/chat/v2/completions",
            json=_persisted_body(
                harness,
                foreign_conversation_id,
                [{"role": "user", "content": "Read the foreign attachment"}],
                [foreign_document_id],
            ),
        )
        assert rejected_foreign.status_code == 404
        assert rejected_foreign.json() == {
            "detail": "One or more selected documents are unavailable"
        }
        assert await _persistence_counts(harness, foreign_conversation_id) == {
            "chats": 0,
            "checkpoints": 0,
            "checkpoint_writes": 0,
            "checkpoint_blobs": 0,
        }
        assert harness.model.recorded_inputs == []

        conversation_id = f"document-attachment-{uuid4()}"
        model = harness.set_model_script(
            [
                read_file(document_path, id="read-immediate"),
                text("The council decision is available immediately."),
                read_file(document_path, id="read-after-restart"),
                text("The council decision survived the manager restart."),
            ]
        )
        first_events = await harness.chat_events(
            _persisted_body(
                harness,
                conversation_id,
                [{"role": "user", "content": "Read the attached council decision."}],
                [document_id],
            )
        )
        assert (
            final_text(first_events) == "The council decision is available immediately."
        )
        first_read = _read_result(model, "read-immediate")
        assert first_read.status == "success"
        assert extracted_text in first_read.content

        metadata = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        saved_conversation = next(
            row for row in metadata if row["conversation_id"] == conversation_id
        )
        assert saved_conversation["document_ids"] == [document_id]
        assert saved_conversation["document_names"] == {
            document_id: "council-decision.txt"
        }
        first_history = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert first_history.status_code == 200
        assert [message["content"] for message in first_history.json()] == [
            "Read the attached council decision.",
            "The council decision is available immediately.",
        ]

        await DocumentCatalogManager.close()
        await FileStoreManager.close()
        await PersistanceHelpers.close()
        await FileStoreManager.init(harness.database.settings)
        await DocumentCatalogManager.init(harness.database.settings)
        await PersistanceHelpers.init(harness.database.settings)

        second_events = await harness.chat_events(
            _persisted_body(
                harness,
                conversation_id,
                _browser_history(
                    (
                        "Read the attached council decision.",
                        "The council decision is available immediately.",
                    ),
                    prompt="Read the attachment again after restart.",
                ),
                [document_id],
            )
        )
        assert (
            final_text(second_events)
            == "The council decision survived the manager restart."
        )
        restarted_read = _read_result(model, "read-after-restart")
        assert restarted_read.status == "success"
        assert extracted_text in restarted_read.content
        reconstructed_history = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert reconstructed_history.status_code == 200
        assert [message["content"] for message in reconstructed_history.json()] == [
            "Read the attached council decision.",
            "The council decision is available immediately.",
            "Read the attachment again after restart.",
            "The council decision survived the manager restart.",
        ]

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")
        assert deleted.status_code == 204
        counts_before_reselection = await _persistence_counts(harness, conversation_id)
        rejected_deleted = await harness.client.post(
            "/v1/chat/v2/completions",
            json=_persisted_body(
                harness,
                conversation_id,
                _browser_history(
                    (
                        "Read the attached council decision.",
                        "The council decision is available immediately.",
                    ),
                    (
                        "Read the attachment again after restart.",
                        "The council decision survived the manager restart.",
                    ),
                    prompt="Read the deleted attachment.",
                ),
                [document_id],
            ),
        )
        assert rejected_deleted.status_code == 404
        assert rejected_deleted.json() == {
            "detail": "One or more selected documents are unavailable"
        }
        assert (
            await _persistence_counts(harness, conversation_id)
            == counts_before_reselection
        )

        historical_metadata = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        historical_conversation = next(
            row
            for row in historical_metadata
            if row["conversation_id"] == conversation_id
        )
        assert historical_conversation["document_ids"] == [document_id]
        assert historical_conversation["document_names"] == {
            document_id: "council-decision.txt"
        }
        harness.assert_model_consumed()


@pytest.mark.asyncio
async def test_persisted_chat_replaces_preserves_and_detaches_document_selections(
    monkeypatch,
) -> None:
    """Persist only this turn's authorized selection and revoke detached file access."""
    async with postgres_http_harness(monkeypatch) as harness:
        harness.parser.text = "First attachment"
        first_upload = await harness.upload_document("first.txt", b"first")
        assert first_upload.status_code == 201
        first_id = str(UUID(first_upload.json()["id"]))

        harness.parser.text = "Second attachment"
        second_upload = await harness.upload_document("second.txt", b"second")
        assert second_upload.status_code == 201
        second_id = str(UUID(second_upload.json()["id"]))
        first_path = get_document_path(first_id)
        second_path = get_document_path(second_id)
        conversation_id = f"document-selection-{uuid4()}"
        model = harness.set_model_script(
            [
                read_file(first_path, id="read-first"),
                text("Read the first attachment."),
                read_file(second_path, id="read-second"),
                text("Read the second attachment."),
                text("The saved attachment remains selected."),
                read_file(second_path, id="read-detached"),
                text("The detached attachment is unavailable."),
            ]
        )

        first_messages = [{"role": "user", "content": "Read the first attachment."}]
        assert (
            final_text(
                await harness.chat_events(
                    _persisted_body(
                        harness, conversation_id, first_messages, [first_id]
                    )
                )
            )
            == "Read the first attachment."
        )

        second_messages = _browser_history(
            ("Read the first attachment.", "Read the first attachment."),
            prompt="Read the second attachment.",
        )
        assert (
            final_text(
                await harness.chat_events(
                    _persisted_body(
                        harness, conversation_id, second_messages, [second_id]
                    )
                )
            )
            == "Read the second attachment."
        )

        metadata = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        saved_conversation = next(
            row for row in metadata if row["conversation_id"] == conversation_id
        )
        assert saved_conversation["document_ids"] == [second_id]
        assert saved_conversation["document_names"] == {second_id: "second.txt"}

        omitted_messages = _browser_history(
            ("Read the first attachment.", "Read the first attachment."),
            ("Read the second attachment.", "Read the second attachment."),
            prompt="Keep the saved attachment selection.",
        )
        omitted_body = _persisted_body(harness, conversation_id, omitted_messages, [])
        del omitted_body["document_ids"]
        assert final_text(await harness.chat_events(omitted_body)) == (
            "The saved attachment remains selected."
        )

        metadata_after_omission = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        omitted_conversation = next(
            row
            for row in metadata_after_omission
            if row["conversation_id"] == conversation_id
        )
        assert omitted_conversation["document_ids"] == [second_id]
        assert omitted_conversation["document_names"] == {second_id: "second.txt"}

        detached_messages = _browser_history(
            ("Read the first attachment.", "Read the first attachment."),
            ("Read the second attachment.", "Read the second attachment."),
            (
                "Keep the saved attachment selection.",
                "The saved attachment remains selected.",
            ),
            prompt="Try to read the detached attachment.",
        )
        assert (
            final_text(
                await harness.chat_events(
                    _persisted_body(harness, conversation_id, detached_messages, [])
                )
            )
            == "The detached attachment is unavailable."
        )
        detached_read = _read_result(model, "read-detached")
        assert detached_read.status == "error"

        metadata_after_detach = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        detached_conversation = next(
            row
            for row in metadata_after_detach
            if row["conversation_id"] == conversation_id
        )
        assert detached_conversation["document_ids"] == []
        assert detached_conversation["document_names"] == {}
        harness.assert_model_consumed()


@pytest.mark.asyncio
async def test_parallel_chats_can_read_the_same_selected_document(monkeypatch) -> None:
    """Independent persisted chats may concurrently read a shared owner document."""
    async with postgres_http_harness(monkeypatch) as harness:
        extracted_text = "A document available to concurrent chats"
        harness.parser.text = extracted_text
        uploaded = await harness.upload_document("shared.txt", b"shared")
        assert uploaded.status_code == 201
        document_id = str(UUID(uploaded.json()["id"]))
        document_path = get_document_path(document_id)
        model = harness.set_model_script(
            [
                read_file(document_path, id="parallel-read-one"),
                read_file(document_path, id="parallel-read-two"),
                text("First parallel chat read the document."),
                text("Second parallel chat read the document."),
            ]
        )

        first_conversation_id = f"parallel-document-one-{uuid4()}"
        second_conversation_id = f"parallel-document-two-{uuid4()}"
        first_events, second_events = await asyncio.gather(
            harness.chat_events(
                _persisted_body(
                    harness,
                    first_conversation_id,
                    [{"role": "user", "content": "Read the shared document."}],
                    [document_id],
                )
            ),
            harness.chat_events(
                _persisted_body(
                    harness,
                    second_conversation_id,
                    [{"role": "user", "content": "Read the shared document."}],
                    [document_id],
                )
            ),
        )

        assert {
            final_text(first_events),
            final_text(second_events),
        } == {
            "First parallel chat read the document.",
            "Second parallel chat read the document.",
        }
        for tool_call_id in ("parallel-read-one", "parallel-read-two"):
            read_result = _read_result(model, tool_call_id)
            assert read_result.status == "success"
            assert extracted_text in read_result.content

        metadata = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        selections = {
            row["conversation_id"]: row["document_ids"]
            for row in metadata
            if row["conversation_id"] in {first_conversation_id, second_conversation_id}
        }
        assert selections == {
            first_conversation_id: [document_id],
            second_conversation_id: [document_id],
        }
        harness.assert_model_consumed()
