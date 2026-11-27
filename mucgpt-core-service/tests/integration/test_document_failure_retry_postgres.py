"""Real PostgreSQL HTTP coverage for durable document failure states."""

import os
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import anyio
import pytest
from sqlalchemy import update
from tests.integration.postgres_http_harness import postgres_http_harness

import core.document_service as document_service
from core.document_service import DocumentLibraryService
from core.virtual_file_system_helper import (
    FileStoreManager,
    create_document_backend,
    get_document_namespace,
    get_document_storage_key,
)
from database.database_models import Document
from database.document_catalog import DocumentCatalogManager
from database.document_lock import document_work_lock
from database.document_repo import DOCUMENT_LIMIT, DocumentRepository

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


async def _catalog_document(user_id: str, document_id: str) -> Document | None:
    async with DocumentCatalogManager.get_session_factory()() as session:
        return await DocumentRepository(session).get_document(user_id, document_id)


async def _body_exists(user_id: str, document_id: str) -> bool:
    return (
        await FileStoreManager.get_store().aget(
            get_document_namespace(user_id), get_document_storage_key(document_id)
        )
        is not None
    )


async def _assert_lock_released(document_id: str) -> None:
    async with document_work_lock(
        DocumentCatalogManager.get_session_factory(), document_id
    ) as acquired:
        assert acquired


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["parser", "store", "finalization"])
async def test_failed_upload_phases_leave_no_durable_document(
    monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    """Failures before or during publication fully compensate their reservation."""
    async with postgres_http_harness(monkeypatch) as harness:
        if failure == "parser":
            harness.parser.parse = AsyncMock(side_effect=RuntimeError("parser failed"))
        elif failure == "store":
            monkeypatch.setattr(
                document_service,
                "create_document_backend",
                lambda _: MagicMock(
                    awrite=AsyncMock(side_effect=RuntimeError("write failed"))
                ),
            )
        else:
            monkeypatch.setattr(
                DocumentRepository, "mark_ready", AsyncMock(return_value=False)
            )

        response = await harness.upload_document()

        assert response.status_code == 500
        assert response.json() == {"detail": "Document could not be stored."}
        assert (await harness.client.get("/v1/documents")).json() == []
        async with DocumentCatalogManager.get_session_factory()() as session:
            assert (
                await DocumentRepository(session).list_documents(harness.owner.user_id)
                == []
            )
        namespace = get_document_namespace(harness.owner.user_id)
        assert await FileStoreManager.get_store().asearch(namespace) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("cleanup_failure", ["body", "catalog"])
async def test_failed_ingestion_cleanup_retains_a_retryable_deleting_row(
    monkeypatch: pytest.MonkeyPatch, cleanup_failure: str
) -> None:
    """A failed compensation keeps its slot until an HTTP deletion retry succeeds."""
    async with postgres_http_harness(monkeypatch) as harness:
        original_mark_ready = DocumentRepository.mark_ready
        monkeypatch.setattr(
            DocumentRepository, "mark_ready", AsyncMock(return_value=False)
        )
        original_delete = document_service.delete_document_body
        original_remove = DocumentRepository.remove_after_cleanup
        if cleanup_failure == "body":
            monkeypatch.setattr(
                document_service,
                "delete_document_body",
                AsyncMock(side_effect=RuntimeError("body cleanup failed")),
            )
        else:
            monkeypatch.setattr(
                DocumentRepository,
                "remove_after_cleanup",
                AsyncMock(side_effect=RuntimeError("catalog cleanup failed")),
            )

        response = await harness.upload_document()
        assert response.status_code == 500
        entries = (await harness.client.get("/v1/documents")).json()
        assert len(entries) == 1
        document_id = str(UUID(entries[0]["id"]))
        assert entries[0]["status"] == "deleting"
        assert await _body_exists(harness.owner.user_id, document_id) is (
            cleanup_failure == "body"
        )
        await _assert_lock_released(document_id)
        monkeypatch.setattr(document_service, "delete_document_body", original_delete)
        monkeypatch.setattr(DocumentRepository, "mark_ready", original_mark_ready)
        monkeypatch.setattr(DocumentRepository, "remove_after_cleanup", original_remove)

        # The retained deleting row is unavailable and still occupies its quota slot.
        for number in range(1, DOCUMENT_LIMIT):
            uploaded = await harness.upload_document(f"document-{number}.txt")
            assert uploaded.status_code == 201
        assert (await harness.upload_document("over-limit.txt")).status_code == 409

        retried = await harness.client.delete(f"/v1/documents/{document_id}")
        assert retried.status_code == 204
        assert await _catalog_document(harness.owner.user_id, document_id) is None
        assert not await _body_exists(harness.owner.user_id, document_id)
        assert (await harness.upload_document("replacement.txt")).status_code == 201


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["processing", "ready", "deleting"])
async def test_deletion_cleans_each_stale_lifecycle_state(
    monkeypatch: pytest.MonkeyPatch, status: str
) -> None:
    """Unlocked processing and deleting rows are recoverable through normal deletion."""
    async with postgres_http_harness(monkeypatch) as harness:
        document_id = "0f1cc6f2-4e9e-4c98-93b5-c3cd2f7f1b01"
        async with DocumentCatalogManager.get_session_factory().begin() as session:
            repository = DocumentRepository(session)
            await repository.reserve_document(
                harness.owner.user_id,
                filename="stale.txt",
                mime_type="text/plain",
                original_size=1,
                document_id=document_id,
            )
            if status != "processing":
                assert await repository.mark_ready(
                    harness.owner.user_id, document_id, text_length=5, preview="stale"
                )
            if status == "deleting":
                assert await repository.mark_deleting(
                    harness.owner.user_id, document_id
                )
        if status == "ready":
            result = await create_document_backend(harness.owner.user_id).awrite(
                get_document_storage_key(document_id), "stale"
            )
            assert result.error is None

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")

        assert deleted.status_code == 204
        assert await _catalog_document(harness.owner.user_id, document_id) is None
        assert not await _body_exists(harness.owner.user_id, document_id)
        await _assert_lock_released(document_id)


@pytest.mark.asyncio
async def test_deletion_of_ready_document_with_missing_body_frees_its_slot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An absent exact body is an idempotent cleanup, not a permanently stuck row."""
    async with postgres_http_harness(monkeypatch) as harness:
        document_id = "9f1cc6f2-4e9e-4c98-93b5-c3cd2f7f1b01"
        async with DocumentCatalogManager.get_session_factory().begin() as session:
            repository = DocumentRepository(session)
            await repository.reserve_document(
                harness.owner.user_id,
                filename="missing-body.txt",
                mime_type="text/plain",
                original_size=1,
                document_id=document_id,
            )
            assert await repository.mark_ready(
                harness.owner.user_id,
                document_id,
                text_length=5,
                preview="stale",
            )

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")

        assert deleted.status_code == 204
        assert await _catalog_document(harness.owner.user_id, document_id) is None
        assert not await _body_exists(harness.owner.user_id, document_id)
        assert (await harness.upload_document("replacement.txt")).status_code == 201


@pytest.mark.asyncio
async def test_corrupt_storage_key_never_deletes_an_unrelated_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A catalog corruption remains visible but cannot expand cleanup scope."""
    async with postgres_http_harness(monkeypatch) as harness:
        uploaded = await harness.upload_document()
        assert uploaded.status_code == 201
        document_id = str(UUID(uploaded.json()["id"]))
        foreign_id = "cf05806a-a8bc-4c4b-b972-617753cfdc04"
        foreign_key = get_document_storage_key(foreign_id)
        result = await create_document_backend(harness.owner.user_id).awrite(
            foreign_key, "unrelated body"
        )
        assert result.error is None
        async with DocumentCatalogManager.get_session_factory().begin() as session:
            await session.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(storage_key=foreign_key)
            )

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")

        assert deleted.status_code == 500
        assert await _catalog_document(harness.owner.user_id, document_id) is not None
        assert await _body_exists(harness.owner.user_id, document_id)
        assert await _body_exists(harness.owner.user_id, foreign_id)
        await _assert_lock_released(document_id)


@pytest.mark.asyncio
async def test_cancelled_deletion_finishes_cleanup_and_releases_its_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cancelled HTTP caller cannot strand document cleanup or its advisory lock."""
    async with postgres_http_harness(monkeypatch) as harness:
        uploaded = await harness.upload_document()
        assert uploaded.status_code == 201
        document_id = str(UUID(uploaded.json()["id"]))
        original_delete = document_service.delete_document_body

        with anyio.CancelScope() as caller:

            async def cancel_after_body(user_id: str, requested_id: str) -> None:
                await original_delete(user_id, requested_id)
                caller.cancel()
                await anyio.sleep(0)

            monkeypatch.setattr(
                document_service, "delete_document_body", cancel_after_body
            )
            await DocumentLibraryService().delete_document(harness.owner, document_id)

        assert caller.cancel_called
        assert await _catalog_document(harness.owner.user_id, document_id) is None
        assert not await _body_exists(harness.owner.user_id, document_id)
        await _assert_lock_released(document_id)
