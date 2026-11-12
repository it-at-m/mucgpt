"""HTTP upload contract, identity, and real ingestion compensation without infra."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from langgraph.store.memory import InMemoryStore
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from api.routers import document_router
from backend import api_app, backend
from config.settings import DocumentConfig, SSOSettings, get_sso_settings
from core import document_service as services
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.virtual_file_system_helper import FileStoreManager, get_document_namespace
from database.database_models import Base, Document

pytestmark = pytest.mark.integration


@pytest.fixture
def upload_api(monkeypatch):
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine, tables=[Document.__table__])

    @asynccontextmanager
    async def begin():
        with Session(engine) as session:
            try:
                yield MagicMock(execute=AsyncMock(side_effect=session.execute))
                session.commit()
            except BaseException:
                session.rollback()
                raise

    store = InMemoryStore()
    monkeypatch.setattr(FileStoreManager, "_file_store", store)
    parser = MagicMock(parse=AsyncMock(return_value="First line\r\nSecond line\n"))
    monkeypatch.setattr(services, "get_parser", lambda: parser)

    @asynccontextmanager
    async def work_lock(_factory, _document_id):
        yield True

    monkeypatch.setattr(services, "document_work_lock", work_lock)
    service = services.DocumentIngestionService(
        MagicMock(begin=begin), DocumentConfig(preview_max_chars=10)
    )
    factory = MagicMock(return_value=service)
    monkeypatch.setattr(document_router, "DocumentIngestionService", factory)
    owner = AuthenticationResult(
        user_id="demo-user-5", token="secret-test-token", department="shared-department"
    )
    previous_overrides = api_app.dependency_overrides.copy()
    api_app.dependency_overrides[authenticate_user] = lambda: owner
    # Exercise the mounted API without running infrastructure startup hooks.
    client = TestClient(backend)
    try:
        yield client, service, parser, engine, store, owner, factory
    finally:
        client.close()
        api_app.dependency_overrides.clear()
        api_app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def post_document(client, *, body=b"original binary", filename="report.pdf", **kwargs):
    return client.post(
        "/api/v1/documents",
        files={"file": (filename, body, "application/pdf")},
        **kwargs,
    )


def rows(engine):
    with Session(engine) as session:
        return list(session.scalars(select(Document)).all())


def test_upload_returns_only_ready_metadata_and_uses_authenticated_owner(upload_api):
    client, _, parser, engine, store, owner, _ = upload_api
    received_files = []

    async def parse(file):
        received_files.append(file)
        assert await file.read() == b"original binary"
        assert rows(engine)[0].status == "processing"
        return "First line\r\nSecond line\n"

    parser.parse.side_effect = parse
    response = post_document(
        client,
        data={
            "user_id": "foreign-user",
            "namespace": "foreign-namespace",
            "path": "/documents/forged.txt",
            "preview": "forged preview",
            "id": "forged-id",
        },
    )
    assert response.status_code == 201
    metadata = response.json()
    document_id = str(UUID(metadata["id"]))
    assert metadata == {
        "id": document_id,
        "filename": "report.pdf",
        "mime_type": "application/pdf",
        "original_size": len(b"original binary"),
        "text_length": len("First line\r\nSecond line\n"),
        "preview": "First line",
        "preview_kind": "initial_excerpt",
        "path": f"/documents/{document_id}.txt",
        "created_at": metadata["created_at"],
    }
    assert metadata["created_at"]
    row = rows(engine)[0]
    assert row.status == "ready" and row.user_id == owner.user_id
    stored = store.get(get_document_namespace(owner.user_id), row.storage_key)
    assert stored.value["content"] == "First line\r\nSecond line\n"
    assert store.search(get_document_namespace("foreign-user")) == []
    assert store.search(get_document_namespace(owner.department)) == []
    assert received_files[0].file.closed


@pytest.mark.parametrize("authorization", [None, "Bearer not.a.valid.jwt"])
def test_authentication_failure_does_not_start_ingestion(upload_api, authorization):
    client, _, parser, engine, _, _, factory = upload_api
    del api_app.dependency_overrides[authenticate_user]
    api_app.dependency_overrides[get_sso_settings] = lambda: SSOSettings()
    headers = {} if authorization is None else {"Authorization": authorization}
    response = post_document(client, headers=headers)
    # Missing required auth header follows the existing auth dependency's 422.
    assert response.status_code == (422 if authorization is None else 401)
    factory.assert_not_called()
    parser.parse.assert_not_awaited()
    assert rows(engine) == []


def test_missing_file_uses_request_validation(upload_api):
    client, _, parser, engine, _, _, factory = upload_api
    response = client.post("/api/v1/documents", data={"filename": "fake.pdf"})
    assert response.status_code == 422
    factory.assert_not_called()
    parser.parse.assert_not_awaited()
    assert rows(engine) == []


@pytest.mark.parametrize("failure", ["empty_upload", "filename", "size", "disabled"])
def test_invalid_uploads_never_reserve_or_parse(upload_api, monkeypatch, failure):
    client, service, parser, engine, _, _, _ = upload_api
    kwargs = {}
    expected = 400
    if failure == "empty_upload":
        kwargs["body"] = b""
    elif failure == "filename":
        kwargs["filename"] = "x" * 256
    elif failure == "size":
        service.settings = DocumentConfig(max_upload_bytes=3)
        expected = 413
    else:
        monkeypatch.setattr(services, "get_parser", lambda: None)
        expected = 503
    response = post_document(client, **kwargs)
    assert response.status_code == expected
    parser.parse.assert_not_awaited()
    assert rows(engine) == []


@pytest.mark.parametrize(
    "text, expected, detail",
    [
        (" \t\r\n", 422, "Document extraction returned no usable text."),
        ("text\x00", 422, "Document extraction returned invalid text."),
        ("é" * 9, 413, "Extracted text exceeds the byte limit"),
    ],
)
def test_extraction_rejection_releases_reservation(upload_api, text, expected, detail):
    client, service, parser, engine, store, owner, _ = upload_api
    service.settings = DocumentConfig(max_text_bytes=16)
    parser.parse.return_value = text
    response = post_document(client)
    assert response.status_code == expected
    assert response.json() == {"detail": detail}
    assert rows(engine) == []
    assert store.search(get_document_namespace(owner.user_id)) == []


def test_eleventh_upload_returns_conflict_without_eviction(upload_api):
    client, _, parser, engine, _, _, _ = upload_api
    ids = [post_document(client).json()["id"] for _ in range(10)]
    response = post_document(client)
    assert response.status_code == 409
    assert response.json() == {"detail": "Document library limit of 10 reached"}
    assert parser.parse.await_count == 10
    assert {row.id for row in rows(engine)} == set(ids)
    assert all(row.status == "ready" for row in rows(engine))


@pytest.mark.parametrize("status", [400, 413, 415, 422, 401, 403, 404, 429, 500, 503])
def test_parser_http_error_mapping_compensates_and_hides_payload(upload_api, status):
    client, _, parser, engine, store, owner, _ = upload_api
    request = httpx.Request("POST", "http://private-parser/extract")
    upstream = httpx.Response(status, request=request, text="secret upstream body")
    parser.parse.side_effect = httpx.HTTPStatusError(
        "secret parser exception", request=request, response=upstream
    )
    response = post_document(client)
    assert response.status_code == (status if status in {400, 413, 415, 422} else 502)
    assert "secret" not in response.text and "private-parser" not in response.text
    assert rows(engine) == []
    assert store.search(get_document_namespace(owner.user_id)) == []


@pytest.mark.parametrize(
    "error, expected",
    [
        (httpx.ReadTimeout("secret timeout"), 504),
        (httpx.ConnectError("secret connection"), 502),
        (httpx.RemoteProtocolError("secret protocol"), 502),
        (RuntimeError("secret internal failure"), 500),
    ],
)
def test_parser_failures_compensate_and_hide_internals(upload_api, error, expected):
    client, _, parser, engine, store, owner, _ = upload_api
    parser.parse.side_effect = error
    response = post_document(client)
    assert response.status_code == expected
    assert "secret" not in response.text
    assert rows(engine) == []
    assert store.search(get_document_namespace(owner.user_id)) == []


def test_failed_storage_returns_safe_error_and_releases_slot(upload_api, monkeypatch):
    client, _, _, engine, store, owner, _ = upload_api
    monkeypatch.setattr(
        services,
        "create_document_backend",
        lambda _: MagicMock(awrite=AsyncMock(return_value=MagicMock(error="secret"))),
    )
    response = post_document(client)
    assert response.status_code == 500
    assert response.json() == {"detail": "Document could not be stored."}
    assert rows(engine) == []
    assert store.search(get_document_namespace(owner.user_id)) == []


def test_upload_openapi_documents_multipart_metadata_and_errors(upload_api):
    schema = api_app.openapi()
    operation = schema["paths"]["/v1/documents"]["post"]
    assert "multipart/form-data" in operation["requestBody"]["content"]
    assert set(operation["responses"]) == {
        "201",
        "400",
        "409",
        "413",
        "415",
        "422",
        "500",
        "502",
        "503",
        "504",
    }
    properties = schema["components"]["schemas"]["DocumentMetadata"]["properties"]
    assert "preview" in properties and "path" in properties
    assert not {"content", "user_id", "storage_key", "namespace"} & properties.keys()
