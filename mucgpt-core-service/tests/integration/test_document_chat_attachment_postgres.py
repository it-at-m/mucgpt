"""Real PostgreSQL coverage for document attachments in persisted chats."""

import asyncio
import os
from collections.abc import Sequence
from uuid import UUID, uuid4

import psycopg
import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from psycopg.conninfo import make_conninfo
from tests.fakes.scripted_chat_model import (
    RecordedModelCall,
    answer_from_tool,
    message_text,
    read_file,
    text,
)
from tests.integration.postgres_http_harness import (
    DEFAULT_SCRIPTED_MODEL,
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
    *,
    model_name: str = DEFAULT_SCRIPTED_MODEL,
) -> dict[str, object]:
    """Build a browser-style persisted request with an explicit attachment list."""
    body = harness.persisted_chat_body(
        "unused", conversation_id=conversation_id, model_name=model_name
    )
    return body | {"messages": list(messages), "document_ids": document_ids}


_PERSISTED_TABLES = ("chats", "checkpoints", "checkpoint_writes", "checkpoint_blobs")


async def _persistence_rows(
    harness: PostgresHttpHarness, conversation_id: str
) -> dict[str, list[str]]:
    """Export durable rows so rejected requests prove no side effect at all.

    Row counts alone cannot show that validation precedes persistence: an
    ownership refresh changes ``chats.updated_at`` without adding a row.
    """
    conninfo = make_conninfo(
        **harness.database.connection_args, dbname=harness.database.name
    )
    async with await psycopg.AsyncConnection.connect(conninfo, autocommit=True) as conn:
        rows: dict[str, list[str]] = {}
        for table in _PERSISTED_TABLES:
            column = "conversation_id" if table == "chats" else "thread_id"
            result = await conn.execute(
                f"SELECT to_jsonb(t)::text FROM {table} AS t "
                f"WHERE {column} = %s ORDER BY to_jsonb(t)::text",
                (conversation_id,),
            )
            rows[table] = [row[0] for row in await result.fetchall()]
        return rows


async def _persistence_counts(
    harness: PostgresHttpHarness, conversation_id: str
) -> dict[str, int]:
    """Count durable rows of a conversation that must not have been written."""
    return {
        table: len(rows)
        for table, rows in (await _persistence_rows(harness, conversation_id)).items()
    }


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


def _chat_model_calls(model: object, prompt: str) -> list[RecordedModelCall]:
    """Select the recorded model calls that belong to one chat."""
    return [
        call
        for call in getattr(model, "recorded_inputs")
        if any(
            isinstance(value, HumanMessage) and prompt in message_text(value.content)
            for value in call.messages
        )
    ]


def _assert_chat_read_document(
    model: object, prompt: str, document_path: str, expected_text: str
) -> ToolMessage:
    """Tie one successful document read to the chat that issued it."""
    calls = _chat_model_calls(model, prompt)
    assert calls, f"Chat {prompt!r} never reached the model"
    tool_calls = [
        tool_call
        for call in calls
        for value in call.messages
        if isinstance(value, AIMessage)
        for tool_call in value.tool_calls
    ]
    assert [tool_call["args"] for tool_call in tool_calls] == [
        {"file_path": document_path}
    ]
    results = [
        value
        for call in calls
        for value in call.messages
        if isinstance(value, ToolMessage) and value.tool_call_id == tool_calls[0]["id"]
    ]
    assert len(results) == 1
    assert results[0].status == "success"
    assert expected_text in message_text(results[0].content)
    return results[0]


def _assert_documents_excluded(model: object, *contents: str) -> None:
    """Prove unavailable documents never reach tool output or model input."""
    recorded_inputs = getattr(model, "recorded_inputs")
    assert recorded_inputs
    for call in recorded_inputs:
        for message in call.messages:
            message_content = message_text(message.content)
            for content in contents:
                assert content not in message_content, (
                    f"Unavailable document content reached the model input: {content!r}"
                )


@pytest.mark.asyncio
async def test_uploaded_attachment_is_read_immediately_and_remains_safe_through_lifecycle(
    monkeypatch,
) -> None:
    """Read a newly uploaded attachment without reload, restart safely, then reject it after deletion."""
    async with postgres_http_harness(monkeypatch) as harness:
        extracted_text = "Council decision\nImmediate durable attachment detail"
        unselected_text = "Unselected owner attachment"
        foreign_text = "Foreign confidential attachment"
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

        # Another owner document is uploaded but never selected: its content may
        # not reach any request, just like another user's document.
        harness.parser.text = unselected_text
        unselected_upload = await harness.upload_document("unselected.txt", b"unused")
        assert unselected_upload.status_code == 201

        # A different user's document must be rejected before a conversation or
        # checkpoint can be created for the owner.
        harness.parser.text = foreign_text
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
                answer_from_tool(tool_call_id="read-immediate"),
                read_file(document_path, id="read-after-restart"),
                answer_from_tool(tool_call_id="read-after-restart"),
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
        first_read = _read_result(model, "read-immediate")
        assert first_read.status == "success"
        # The answer is composed from the tool result, so it can only contain the
        # document detail if PostgreSQL actually served the stored content.
        first_answer = message_text(first_read.content)
        assert extracted_text in first_answer
        assert final_text(first_events) == first_answer
        _assert_documents_excluded(model, foreign_text, unselected_text)

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
            first_answer,
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
                    ("Read the attached council decision.", first_answer),
                    prompt="Read the attachment again after restart.",
                ),
                [document_id],
            )
        )
        restarted_read = _read_result(model, "read-after-restart")
        assert restarted_read.status == "success"
        second_answer = message_text(restarted_read.content)
        assert extracted_text in second_answer
        assert final_text(second_events) == second_answer
        _assert_documents_excluded(model, foreign_text, unselected_text)
        reconstructed_history = await harness.client.get(
            f"/v1/conversations/{conversation_id}/messages"
        )
        assert reconstructed_history.status_code == 200
        assert [message["content"] for message in reconstructed_history.json()] == [
            "Read the attached council decision.",
            first_answer,
            "Read the attachment again after restart.",
            second_answer,
        ]

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")
        assert deleted.status_code == 204
        rows_before_reselection = await _persistence_rows(harness, conversation_id)
        rejected_deleted = await harness.client.post(
            "/v1/chat/v2/completions",
            json=_persisted_body(
                harness,
                conversation_id,
                _browser_history(
                    ("Read the attached council decision.", first_answer),
                    ("Read the attachment again after restart.", second_answer),
                    prompt="Read the deleted attachment.",
                ),
                [document_id],
            ),
        )
        assert rejected_deleted.status_code == 404
        assert rejected_deleted.json() == {
            "detail": "One or more selected documents are unavailable"
        }
        assert await _persistence_rows(harness, conversation_id) == (
            rows_before_reselection
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
        first_read = _read_result(model, "read-first")
        assert first_read.status == "success"
        assert "First attachment" in message_text(first_read.content)
        assert "Second attachment" not in message_text(first_read.content)

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
        second_read = _read_result(model, "read-second")
        assert second_read.status == "success"
        assert "Second attachment" in message_text(second_read.content)
        assert "First attachment" not in message_text(second_read.content)

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
        first_model = harness.set_model_script(
            [
                read_file(document_path, id="parallel-read-one"),
                answer_from_tool(tool_call_id="parallel-read-one"),
            ],
            model_name="scripted-model-parallel-one",
        )
        second_model = harness.set_model_script(
            [
                read_file(document_path, id="parallel-read-two"),
                answer_from_tool(tool_call_id="parallel-read-two"),
            ],
            model_name="scripted-model-parallel-two",
        )

        first_conversation_id = f"parallel-document-one-{uuid4()}"
        second_conversation_id = f"parallel-document-two-{uuid4()}"
        first_prompt = "Read the shared document in the first parallel chat."
        second_prompt = "Read the shared document in the second parallel chat."
        first_events, second_events = await asyncio.gather(
            harness.chat_events(
                _persisted_body(
                    harness,
                    first_conversation_id,
                    [{"role": "user", "content": first_prompt}],
                    [document_id],
                    model_name="scripted-model-parallel-one",
                )
            ),
            harness.chat_events(
                _persisted_body(
                    harness,
                    second_conversation_id,
                    [{"role": "user", "content": second_prompt}],
                    [document_id],
                    model_name="scripted-model-parallel-two",
                )
            ),
        )

        # Each chat has its own script, so each answer must come from that chat's
        # own read of the PostgreSQL-backed document.
        for chat_model, prompt, events in (
            (first_model, first_prompt, first_events),
            (second_model, second_prompt, second_events),
        ):
            read = _assert_chat_read_document(
                chat_model, prompt, document_path, extracted_text
            )
            assert final_text(events) == message_text(read.content)

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


@pytest.mark.asyncio
async def test_document_insert_does_not_block_chats_reading_other_documents(
    monkeypatch,
) -> None:
    """An in-progress upload remains isolated from chats reading existing documents."""
    async with postgres_http_harness(monkeypatch) as harness:
        harness.parser.text = "First existing document"
        first_upload = await harness.upload_document("first-existing.txt", b"first")
        assert first_upload.status_code == 201
        first_id = str(UUID(first_upload.json()["id"]))

        harness.parser.text = "Second existing document"
        second_upload = await harness.upload_document("second-existing.txt", b"second")
        assert second_upload.status_code == 201
        second_id = str(UUID(second_upload.json()["id"]))

        insertion_started = asyncio.Event()
        finish_insertion = asyncio.Event()

        async def delayed_parse(_file: object) -> str:
            insertion_started.set()
            await finish_insertion.wait()
            return "Document inserted during chats"

        monkeypatch.setattr(harness.parser, "parse", delayed_parse)
        insertion = asyncio.create_task(
            harness.upload_document("inserted-during-chats.txt", b"inserted")
        )
        await insertion_started.wait()

        first_path = get_document_path(first_id)
        second_path = get_document_path(second_id)
        first_model = harness.set_model_script(
            [
                read_file(first_path, id="concurrent-insert-read-first"),
                answer_from_tool(tool_call_id="concurrent-insert-read-first"),
            ],
            model_name="scripted-model-insert-one",
        )
        second_model = harness.set_model_script(
            [
                read_file(second_path, id="concurrent-insert-read-second"),
                answer_from_tool(tool_call_id="concurrent-insert-read-second"),
            ],
            model_name="scripted-model-insert-two",
        )
        first_conversation_id = f"insert-during-chat-one-{uuid4()}"
        second_conversation_id = f"insert-during-chat-two-{uuid4()}"
        first_prompt = "Read the first existing document."
        second_prompt = "Read the second existing document."
        first_events, second_events = await asyncio.gather(
            harness.chat_events(
                _persisted_body(
                    harness,
                    first_conversation_id,
                    [{"role": "user", "content": first_prompt}],
                    [first_id],
                    model_name="scripted-model-insert-one",
                )
            ),
            harness.chat_events(
                _persisted_body(
                    harness,
                    second_conversation_id,
                    [{"role": "user", "content": second_prompt}],
                    [second_id],
                    model_name="scripted-model-insert-two",
                )
            ),
        )

        for chat_model, prompt, events, path, content in (
            (
                first_model,
                first_prompt,
                first_events,
                first_path,
                "First existing document",
            ),
            (
                second_model,
                second_prompt,
                second_events,
                second_path,
                "Second existing document",
            ),
        ):
            read = _assert_chat_read_document(chat_model, prompt, path, content)
            assert final_text(events) == message_text(read.content)

        finish_insertion.set()
        inserted = await insertion
        assert inserted.status_code == 201
        inserted_id = str(UUID(inserted.json()["id"]))
        stored_inserted_document = await FileStoreManager.get_store().aget(
            get_document_namespace(harness.owner.user_id),
            get_document_storage_key(inserted_id),
        )
        assert stored_inserted_document is not None
        assert (
            stored_inserted_document.value["content"]
            == "Document inserted during chats"
        )

        metadata = await PersistanceHelpers.get_conversations_for_user(
            harness.owner.user_id
        )
        selections = {
            row["conversation_id"]: row["document_ids"]
            for row in metadata
            if row["conversation_id"] in {first_conversation_id, second_conversation_id}
        }
        assert selections == {
            first_conversation_id: [first_id],
            second_conversation_id: [second_id],
        }
        harness.assert_model_consumed()
