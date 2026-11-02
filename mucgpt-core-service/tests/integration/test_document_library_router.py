"""Library HTTP behavior using real catalog SQL and an in-memory body store."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from anyio import CancelScope, run, sleep
from deepagents.backends.utils import create_file_data
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langgraph.store.memory import InMemoryStore
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from api.routers import document_router
from core import document_service as services
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.virtual_file_system_helper import (
    FileStoreManager,
    get_document_namespace,
    get_document_path,
    get_document_storage_key,
)
from database.database_models import Base, Document
from database.document_repo import DocumentQuotaExceededError, DocumentRepository

pytestmark = pytest.mark.integration


@pytest.fixture
def library_api(monkeypatch):
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine, tables=[Document.__table__])

    @asynccontextmanager
    async def session_scope():
        with Session(engine) as session:
            yield MagicMock(execute=AsyncMock(side_effect=session.execute))

    @asynccontextmanager
    async def transaction():
        with Session(engine) as session:
            try:
                yield MagicMock(execute=AsyncMock(side_effect=session.execute))
                session.commit()
            except BaseException:
                session.rollback()
                raise

    session_factory = MagicMock(side_effect=session_scope, begin=transaction)
    session_factory.locked_ids = set()

    @asynccontextmanager
    async def work_lock(_factory, document_id):
        if document_id in session_factory.locked_ids:
            yield False
            return
        session_factory.locked_ids.add(document_id)
        try:
            yield True
        finally:
            session_factory.locked_ids.remove(document_id)

    monkeypatch.setattr(services, "document_work_lock", work_lock)
    service = services.DocumentLibraryService(session_factory)
    factory = MagicMock(return_value=service)
    monkeypatch.setattr(document_router, "DocumentLibraryService", factory)
    memory_store = InMemoryStore()
    store = MagicMock(wraps=memory_store)
    store.aget = AsyncMock(wraps=memory_store.aget)
    store.adelete = AsyncMock(wraps=memory_store.adelete)
    monkeypatch.setattr(FileStoreManager, "_file_store", store)
    owner = AuthenticationResult(
        user_id="demo-user-5", token="secret", department="shared"
    )
    api = FastAPI()
    api.include_router(document_router.router)
    api.dependency_overrides[authenticate_user] = lambda: owner
    app = FastAPI()
    app.mount("/api", api)
    try:
        with TestClient(app) as client:
            yield client, api, service, engine, store, owner, factory
    finally:
        engine.dispose()


def add_document(engine, owner, *, status="ready", slot=0, document_id=None):
    document_id = document_id or str(uuid4())
    with Session(engine) as session:
        session.add(
            Document(
                id=document_id,
                user_id=owner,
                slot=slot,
                filename=f"document-{slot}.pdf",
                mime_type="application/pdf",
                original_size=100,
                text_length=5000 if status == "ready" else None,
                preview="initial excerpt" if status == "ready" else None,
                preview_kind="initial_excerpt" if status == "ready" else None,
                storage_key=get_document_storage_key(document_id),
                status=status,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )
        )
        session.commit()
    return document_id


def rows(engine):
    with Session(engine) as session:
        return list(session.scalars(select(Document)).all())


def test_empty_library_returns_empty_list_without_body_access(library_api):
    client, _, _, _, store, _, _ = library_api
    response = client.get("/api/v1/documents")
    assert response.status_code == 200
    assert response.json() == []
    assert store.mock_calls == []


def test_listing_is_owner_scoped_ordered_and_includes_quota_states(library_api):
    client, _, _, engine, store, owner, _ = library_api
    ids = [
        add_document(engine, owner.user_id, status=status, slot=slot)
        for slot, status in enumerate(["ready", "processing", "deleting"])
    ]
    foreign_id = add_document(engine, "foreign-owner")
    response = client.get("/api/v1/documents?user_id=foreign-owner&namespace=foreign")
    assert response.status_code == 200
    entries = response.json()
    assert [entry["id"] for entry in entries] == sorted(ids)
    assert foreign_id not in response.text
    assert len(entries) == len(
        [row for row in rows(engine) if row.user_id == owner.user_id]
    )
    ready = next(entry for entry in entries if entry["status"] == "ready")
    assert ready["text_length"] == 5000 and ready["preview"] == "initial excerpt"
    for entry in entries:
        assert entry["path"] == get_document_path(entry["id"])
        assert set(entry) == {
            "id",
            "filename",
            "mime_type",
            "original_size",
            "text_length",
            "preview",
            "preview_kind",
            "path",
            "status",
            "created_at",
        }
        if entry["status"] != "ready":
            assert entry["text_length"] is None and entry["preview"] is None
    assert store.mock_calls == []


def test_listing_requires_authentication_before_service_access(library_api):
    client, api, _, _, store, _, factory = library_api
    del api.dependency_overrides[authenticate_user]
    response = client.get("/api/v1/documents")
    assert response.status_code == 422
    factory.assert_not_called()
    assert store.mock_calls == []


def test_listing_failure_closes_session_and_hides_internal_details(library_api):
    client, _, service, _, store, _, _ = library_api
    session = MagicMock(
        execute=AsyncMock(side_effect=RuntimeError("secret SQL failure"))
    )
    closed = []

    @asynccontextmanager
    async def failing_session():
        try:
            yield session
        finally:
            closed.append(True)

    service.session_factory.side_effect = failing_session
    response = client.get("/api/v1/documents")
    assert response.status_code == 500
    assert response.json() == {"detail": "Document library could not be loaded."}
    assert closed == [True]
    assert store.mock_calls == []


def test_library_openapi_exposes_only_public_metadata(library_api):
    _, api, *_ = library_api
    schema = api.openapi()
    operation = schema["paths"]["/v1/documents"]["get"]
    response_schema = operation["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    assert response_schema["type"] == "array"
    assert response_schema["items"] == {
        "$ref": "#/components/schemas/DocumentLibraryEntry"
    }
    properties = schema["components"]["schemas"]["DocumentLibraryEntry"]["properties"]
    assert properties["status"]["enum"] == ["processing", "ready", "deleting"]
    assert (
        not {"content", "user_id", "storage_key", "slot", "namespace"}
        & properties.keys()
    )


@pytest.mark.parametrize(
    ("status", "body_present"),
    [("ready", True), ("deleting", True), ("deleting", False)],
)
def test_deletion_cleans_only_owned_body_and_frees_slot(
    library_api, status, body_present
):
    client, _, _, engine, store, owner, _ = library_api
    document_id = add_document(engine, owner.user_id, status=status)
    key = get_document_storage_key(document_id)
    namespace = get_document_namespace(owner.user_id)
    memory_store = store._mock_wraps
    if body_present:
        memory_store.put(namespace, key, create_file_data("owned text"))
    foreign_namespace = get_document_namespace("foreign-owner")
    memory_store.put(foreign_namespace, key, create_file_data("foreign text"))
    foreign_id = add_document(engine, "foreign-owner")

    response = client.delete(f"/api/v1/documents/{document_id.upper()}")
    assert response.status_code == 204
    assert response.content == b""
    store.adelete.assert_awaited_once_with(namespace, key)
    assert memory_store.get(namespace, key) is None
    assert memory_store.get(foreign_namespace, key).value["content"] == "foreign text"
    assert [row.id for row in rows(engine)] == [foreign_id]
    assert client.get("/api/v1/documents").json() == []
    # A completed deletion has no remaining owned catalog row; repeat requests
    # report the same unavailable result as any other absent UUID.
    assert client.delete(f"/api/v1/documents/{document_id}").status_code == 404
    assert store.adelete.await_count == 1


@pytest.mark.parametrize("foreign_status", ["ready", "processing", "deleting"])
def test_foreign_and_missing_deletions_are_uniform_and_never_touch_store(
    library_api, foreign_status
):
    client, _, _, engine, store, owner, _ = library_api
    foreign_id = add_document(engine, "foreign-owner", status=foreign_status)
    missing_id = str(uuid4())
    responses = [
        client.delete(f"/api/v1/documents/{document_id}?user_id=foreign-owner")
        for document_id in [foreign_id, missing_id]
    ]
    assert [response.status_code for response in responses] == [404, 404]
    assert all(
        response.json() == {"detail": "Document is unavailable."}
        for response in responses
    )
    assert store.mock_calls == []
    assert rows(engine)[0].user_id != owner.user_id


def test_processing_document_cannot_be_deleted_while_ingestion_may_write(library_api):
    client, _, _, engine, store, owner, _ = library_api
    document_id = add_document(engine, owner.user_id, status="processing")
    response = client.delete(f"/api/v1/documents/{document_id}")
    assert response.status_code == 409
    assert response.json() == {"detail": "Document is still processing."}
    assert rows(engine)[0].status == "processing"
    assert store.mock_calls == []


@pytest.mark.parametrize("failure", ["body", "catalog_remove", "catalog_commit"])
def test_failed_cleanup_retains_slot_and_unavailable_state_until_retry(
    library_api, monkeypatch, failure
):
    client, _, service, engine, store, owner, _ = library_api
    ids = [add_document(engine, owner.user_id, slot=slot) for slot in range(10)]
    document_id = ids[0]
    key = get_document_storage_key(document_id)
    namespace = get_document_namespace(owner.user_id)
    store._mock_wraps.put(namespace, key, create_file_data("owned text"))

    with monkeypatch.context() as patch:
        if failure == "body":

            async def fail_body_delete(user_id, requested_id):
                assert user_id == owner.user_id and requested_id == document_id
                assert (
                    next(row for row in rows(engine) if row.id == document_id).status
                    == "deleting"
                )
                async with service.session_factory() as session:
                    with pytest.raises(services.DocumentUnavailableError):
                        await services.DocumentService(
                            DocumentRepository(session)
                        ).resolve_selected_documents(owner, [document_id])
                raise RuntimeError("secret store failure")

            patch.setattr(services, "delete_document_body", fail_body_delete)
        elif failure == "catalog_remove":
            patch.setattr(
                DocumentRepository,
                "remove_after_cleanup",
                AsyncMock(side_effect=RuntimeError("secret catalog failure")),
            )
        else:
            original_begin = service.session_factory.begin
            transaction_count = 0

            @asynccontextmanager
            async def failing_commit():
                nonlocal transaction_count
                transaction_count += 1
                async with original_begin() as session:
                    yield session
                    if transaction_count == 2:
                        raise RuntimeError("secret commit failure")

            patch.setattr(service.session_factory, "begin", failing_commit)

        response = client.delete(f"/api/v1/documents/{document_id}")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Document could not be deleted. Retry deletion."
    }
    assert service.session_factory.locked_ids == set()
    assert len(rows(engine)) == 10
    assert (
        next(row for row in rows(engine) if row.id == document_id).status == "deleting"
    )
    assert (store._mock_wraps.get(namespace, key) is not None) == (failure == "body")
    entries = client.get("/api/v1/documents").json()
    assert (
        next(entry for entry in entries if entry["id"] == document_id)["status"]
        == "deleting"
    )

    async def reserve():
        async with service.session_factory.begin() as session:
            document = await DocumentRepository(session).reserve_document(
                owner.user_id,
                filename="replacement.pdf",
                mime_type="application/pdf",
                original_size=1,
            )
            return document.id

    with pytest.raises(DocumentQuotaExceededError):
        run(reserve)
    assert client.delete(f"/api/v1/documents/{document_id}").status_code == 204
    assert service.session_factory.locked_ids == set()
    assert store._mock_wraps.get(namespace, key) is None
    assert len(rows(engine)) == 9
    replacement_id = run(reserve)
    assert len(rows(engine)) == 10
    assert next(row for row in rows(engine) if row.id == replacement_id).slot == 0


def test_deletion_rejects_inconsistent_storage_key_without_body_access(library_api):
    client, _, _, engine, store, owner, _ = library_api
    document_id = add_document(engine, owner.user_id)
    with Session(engine) as session:
        session.get(Document, document_id).storage_key = "/foreign-key.txt"
        session.commit()
    response = client.delete(f"/api/v1/documents/{document_id}")
    assert response.status_code == 500
    assert "foreign-key" not in response.text
    assert rows(engine)[0].status == "ready"
    assert store.mock_calls == []


def test_invalid_delete_id_and_missing_auth_do_not_open_library(library_api):
    client, api, _, _, store, _, factory = library_api
    response = client.delete("/api/v1/documents/not-a-uuid")
    assert response.status_code == 422
    del api.dependency_overrides[authenticate_user]
    response = client.delete(f"/api/v1/documents/{uuid4()}")
    assert response.status_code == 422
    factory.assert_not_called()
    assert store.mock_calls == []


def test_authorized_deletion_finishes_cleanup_when_caller_is_cancelled(
    library_api, monkeypatch
):
    _, _, service, engine, store, owner, _ = library_api
    document_id = add_document(engine, owner.user_id)
    namespace = get_document_namespace(owner.user_id)
    key = get_document_storage_key(document_id)
    store._mock_wraps.put(namespace, key, create_file_data("owned text"))
    original_delete = services.delete_document_body

    async def delete_with_cancelled_caller():
        with CancelScope() as caller:

            async def cancel_after_body(user_id, requested_id):
                await original_delete(user_id, requested_id)
                caller.cancel()
                await sleep(0)

            monkeypatch.setattr(services, "delete_document_body", cancel_after_body)
            await service.delete_document(owner, document_id)

    run(delete_with_cancelled_caller)
    assert rows(engine) == []
    assert store._mock_wraps.get(namespace, key) is None


def test_delete_openapi_has_uuid_path_and_bodyless_success(library_api):
    _, api, *_ = library_api
    operation = api.openapi()["paths"]["/v1/documents/{document_id}"]["delete"]
    assert operation["parameters"][0]["schema"]["format"] == "uuid"
    assert "content" not in operation["responses"]["204"]
    assert {"404", "409", "422", "500"} <= operation["responses"].keys()


def test_delete_holds_lock_through_cleanup_and_rejects_concurrent_worker(
    library_api, monkeypatch
):
    _, _, service, engine, store, owner, _ = library_api
    document_id = add_document(engine, owner.user_id)
    key = get_document_storage_key(document_id)
    namespace = get_document_namespace(owner.user_id)
    store._mock_wraps.put(namespace, key, create_file_data("owned text"))
    original_delete = services.delete_document_body
    original_mark = DocumentRepository.mark_deleting
    original_remove = DocumentRepository.remove_after_cleanup

    async def mark(repository, user_id, requested_id, **kwargs):
        assert requested_id in service.session_factory.locked_ids
        return await original_mark(repository, user_id, requested_id, **kwargs)

    async def delete(user_id, requested_id):
        assert requested_id in service.session_factory.locked_ids
        assert rows(engine)[0].status == "deleting"
        other_worker = services.DocumentLibraryService(service.session_factory)
        with pytest.raises(services.DocumentProcessingError, match="busy"):
            await other_worker.delete_document(owner, document_id)
        await original_delete(user_id, requested_id)

    async def remove(repository, user_id, requested_id):
        assert requested_id in service.session_factory.locked_ids
        return await original_remove(repository, user_id, requested_id)

    monkeypatch.setattr(DocumentRepository, "mark_deleting", mark)
    monkeypatch.setattr(services, "delete_document_body", delete)
    monkeypatch.setattr(DocumentRepository, "remove_after_cleanup", remove)
    run(service.delete_document, owner, document_id)
    assert service.session_factory.locked_ids == set()
    assert rows(engine) == []
    store.adelete.assert_awaited_once_with(namespace, key)


@pytest.mark.parametrize("status", ["ready", "deleting", "processing", "foreign"])
def test_busy_lock_preserves_metadata_body_and_ownership_responses(library_api, status):
    client, _, service, engine, store, owner, _ = library_api
    document_id = add_document(
        engine,
        "foreign-owner" if status == "foreign" else owner.user_id,
        status="ready" if status == "foreign" else status,
    )
    service.session_factory.locked_ids.add(document_id)
    response = client.delete(f"/api/v1/documents/{document_id}")
    assert response.status_code == (404 if status == "foreign" else 409)
    if status in ("ready", "deleting"):
        assert response.json() == {"detail": "Document is busy. Retry deletion."}
    assert len(rows(engine)) == 1
    assert service.session_factory.locked_ids == {document_id}
    assert store.mock_calls == []
