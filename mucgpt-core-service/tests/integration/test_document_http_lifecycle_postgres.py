"""Real PostgreSQL HTTP coverage for the complete document-library lifecycle."""

import os
from uuid import UUID

import pytest
from tests.integration.postgres_http_harness import postgres_http_harness

from core.virtual_file_system_helper import (
    FileStoreManager,
    get_document_namespace,
    get_document_storage_key,
)
from database.document_catalog import DocumentCatalogManager
from database.document_repo import DOCUMENT_LIMIT, DocumentRepository

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST"),
        reason="real PostgreSQL opt-in required",
    ),
]


async def _catalog_document(user_id: str, document_id: str):
    async with DocumentCatalogManager.get_session_factory()() as session:
        return await DocumentRepository(session).get_document(user_id, document_id)


@pytest.mark.asyncio
async def test_document_http_lifecycle_survives_restart_and_deletion(
    monkeypatch,
) -> None:
    """Upload, restart, authorize, delete, and reuse a real document slot."""
    async with postgres_http_harness(monkeypatch) as harness:
        extracted_text = "Council decision\nDurable extracted detail"
        harness.parser.text = extracted_text

        uploaded = await harness.upload_document("council-decision.txt", b"source")

        assert uploaded.status_code == 201
        metadata = uploaded.json()
        document_id = str(UUID(metadata["id"]))
        assert metadata == {
            "id": document_id,
            "filename": "council-decision.txt",
            "mime_type": "text/plain",
            "original_size": len(b"source"),
            "text_length": len(extracted_text),
            "preview": "Council decision\nDurable extracted detail",
            "preview_kind": "initial_excerpt",
            "path": f"/documents/{document_id}.txt",
            "created_at": metadata["created_at"],
        }
        assert metadata["created_at"]

        catalog_document = await _catalog_document(harness.owner.user_id, document_id)
        assert catalog_document is not None
        assert catalog_document.status == "ready"
        assert catalog_document.storage_key == get_document_storage_key(document_id)
        stored_document = await FileStoreManager.get_store().aget(
            get_document_namespace(harness.owner.user_id),
            get_document_storage_key(document_id),
        )
        assert stored_document is not None
        assert stored_document.value["content"] == extracted_text

        owner_documents = await harness.client.get("/v1/documents")
        assert owner_documents.status_code == 200
        assert [document["id"] for document in owner_documents.json()] == [document_id]

        with harness.as_user(harness.foreign_user) as foreign_harness:
            foreign_documents = await foreign_harness.client.get("/v1/documents")
            assert foreign_documents.status_code == 200
            assert foreign_documents.json() == []
            foreign_delete = await foreign_harness.client.delete(
                f"/v1/documents/{document_id}"
            )
            assert foreign_delete.status_code == 404
            assert foreign_delete.json() == {"detail": "Document is unavailable."}

        await DocumentCatalogManager.close()
        await FileStoreManager.close()
        await FileStoreManager.init(harness.database.settings)
        await DocumentCatalogManager.init(harness.database.settings)

        restarted_documents = await harness.client.get("/v1/documents")
        assert restarted_documents.status_code == 200
        assert restarted_documents.json() == [metadata | {"status": "ready"}]
        restarted_stored_document = await FileStoreManager.get_store().aget(
            get_document_namespace(harness.owner.user_id),
            get_document_storage_key(document_id),
        )
        assert restarted_stored_document is not None
        assert restarted_stored_document.value["content"] == extracted_text

        for number in range(1, DOCUMENT_LIMIT):
            response = await harness.upload_document(
                f"additional-document-{number}.txt", b"source"
            )
            assert response.status_code == 201

        deleted = await harness.client.delete(f"/v1/documents/{document_id}")
        assert deleted.status_code == 204
        assert await _catalog_document(harness.owner.user_id, document_id) is None
        assert (
            await FileStoreManager.get_store().aget(
                get_document_namespace(harness.owner.user_id),
                get_document_storage_key(document_id),
            )
            is None
        )

        repeated_deletion = await harness.client.delete(f"/v1/documents/{document_id}")
        assert repeated_deletion.status_code == 404
        assert repeated_deletion.json() == {"detail": "Document is unavailable."}

        replacement = await harness.upload_document("replacement.txt", b"source")
        assert replacement.status_code == 201
        documents_after_replacement = await harness.client.get("/v1/documents")
        assert documents_after_replacement.status_code == 200
        assert len(documents_after_replacement.json()) == DOCUMENT_LIMIT
