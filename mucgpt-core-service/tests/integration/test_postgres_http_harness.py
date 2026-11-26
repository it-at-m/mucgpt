"""Focused contract tests for the reusable PostgreSQL HTTP harness."""

import os

import pytest
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres import AsyncPostgresStore
from tests.fakes.scripted_chat_model import text
from tests.integration.postgres_http_harness import (
    final_text,
    postgres_http_harness,
)

from core.persistance_helpers import PersistanceHelpers
from core.virtual_file_system_helper import FileStoreManager

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


@pytest.mark.asyncio
async def test_harness_uses_real_migrated_postgres_managers(monkeypatch) -> None:
    async with postgres_http_harness(monkeypatch) as harness:
        assert harness.database.name.startswith("http_harness_")
        assert isinstance(PersistanceHelpers.get_checkpointer(), AsyncPostgresSaver)
        assert isinstance(FileStoreManager.get_store(), AsyncPostgresStore)


@pytest.mark.asyncio
async def test_harness_routes_parser_and_user_switching(monkeypatch) -> None:
    async with postgres_http_harness(monkeypatch) as harness:
        uploaded = await harness.upload_document("council-note.txt", b"source text")

        assert uploaded.status_code == 201
        assert harness.parser.filenames == ["council-note.txt"]
        assert (await harness.client.get("/v1/documents")).status_code == 200
        assert len((await harness.client.get("/v1/documents")).json()) == 1

        with harness.as_user(harness.foreign_user) as foreign_harness:
            foreign_documents = await foreign_harness.client.get("/v1/documents")
            assert foreign_documents.status_code == 200
            assert foreign_documents.json() == []

        owner_documents = await harness.client.get("/v1/documents")
        assert owner_documents.status_code == 200
        assert len(owner_documents.json()) == 1


@pytest.mark.asyncio
async def test_harness_runs_real_agent_and_decodes_agui_events(monkeypatch) -> None:
    async with postgres_http_harness(monkeypatch) as harness:
        model = harness.set_model_script([text("A deterministic answer")])

        events = await harness.chat_events(harness.persisted_chat_body("Hello"))

        assert final_text(events) == "A deterministic answer"
        assert any(event["type"] == "RUN_FINISHED" for event in events)
        assert model.recorded_inputs


@pytest.mark.asyncio
async def test_harness_scripts_each_model_name_independently(monkeypatch) -> None:
    async with postgres_http_harness(monkeypatch) as harness:
        harness.set_model_script(
            [text("First scripted answer")], model_name="scripted-model-one"
        )
        harness.set_model_script(
            [text("Second scripted answer")], model_name="scripted-model-two"
        )

        first_events = await harness.chat_events(
            harness.persisted_chat_body("Hello", model_name="scripted-model-one")
        )
        second_events = await harness.chat_events(
            harness.persisted_chat_body("Hello", model_name="scripted-model-two")
        )

        assert final_text(first_events) == "First scripted answer"
        assert final_text(second_events) == "Second scripted answer"
        assert {"scripted-model-one", "scripted-model-two"} <= harness.models.keys()
        harness.assert_model_consumed()
