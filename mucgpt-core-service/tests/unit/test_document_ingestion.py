"""Exercise real catalog SQL and StoreBackend with injected lifecycle failures."""

import asyncio
import io
import sys
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import anyio
import httpx
import pytest
import tiktoken
from fastapi import UploadFile
from langgraph.store.memory import InMemoryStore
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from starlette.datastructures import Headers

from config.settings import DocumentConfig
from core import document_service as services
from core.auth_models import AuthenticationResult
from core.virtual_file_system_helper import (
    FileStoreManager,
    create_backend,
    create_document_backend,
    get_document_namespace,
    get_document_storage_key,
)
from database.database_models import Base, Document
from database.document_repo import DocumentQuotaExceededError, DocumentRepository
from parsing import xberg


class CatalogSessions:
    """Adapt synchronous SQLite transactions to the async session factory contract."""

    def __init__(self, engine):
        self.engine = engine
        self.active = 0
        self.phases = 0
        self.fail_commit = None
        self.ambiguous_commit = False

    @asynccontextmanager
    async def begin(self):
        self.phases += 1
        phase = self.phases
        with Session(self.engine) as session:
            self.active += 1
            try:
                yield MagicMock(execute=AsyncMock(side_effect=session.execute))
                if phase == self.fail_commit and not self.ambiguous_commit:
                    raise RuntimeError("commit failed")
                session.commit()
                if phase == self.fail_commit:
                    raise RuntimeError("commit acknowledgement lost")
            except BaseException:
                session.rollback()
                raise
            finally:
                self.active -= 1

    def rows(self):
        with Session(self.engine) as session:
            return list(session.scalars(select(Document)).all())


def user(user_id="demo-user-5"):
    return AuthenticationResult(user_id=user_id, token="test", department="shared")


def upload(
    body=b"original binary",
    *,
    mime="application/pdf",
    size=None,
    filename="document.pdf",
):
    return UploadFile(
        io.BytesIO(body),
        filename=filename,
        size=size,
        headers=Headers({"content-type": mime}),
    )


@pytest.fixture
def ingestion(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine, tables=[Document.__table__])
    sessions = CatalogSessions(engine)
    store = InMemoryStore()
    monkeypatch.setattr(FileStoreManager, "_file_store", store)
    parser = MagicMock(
        parse=AsyncMock(return_value="  First line\r\n\nSecond line\n  ")
    )
    monkeypatch.setattr(services, "get_parser", lambda: parser)
    service = services.DocumentIngestionService(sessions, DocumentConfig())
    yield service, sessions, store, parser
    engine.dispose()


@pytest.mark.asyncio
async def test_complete_text_ready_metadata_and_authenticated_namespace(ingestion):
    service, sessions, store, parser = ingestion
    file = upload(size=1)  # Do not trust an understated supplied size.
    text = parser.parse.return_value

    async def parse(received):
        assert sessions.active == 0
        assert (await received.read()) == b"original binary"
        rows = sessions.rows()
        assert len(rows) == 1 and rows[0].status == "processing"
        assert (
            store.get(get_document_namespace(user().user_id), rows[0].storage_key)
            is None
        )
        return text

    parser.parse.side_effect = parse
    metadata = await service.ingest_document(user(), file)
    row = sessions.rows()[0]
    assert row.status == "ready"
    assert row.user_id == "demo-user-5"
    assert metadata.original_size == len(b"original binary")
    assert metadata.text_length == len(text)
    assert metadata.preview_kind == "initial_excerpt"
    assert text.startswith(metadata.preview)
    assert not hasattr(metadata, "content") and not hasattr(metadata, "user_id")
    assert not file.file.closed
    result = await create_backend(user().user_id, [metadata.id]).aread(metadata.path)
    assert result.error is None
    # StoreBackend retains exact bytes but its line-window reads join lines with LF.
    assert result.file_data["content"] == text.replace("\r\n", "\n")
    assert (
        store.get(get_document_namespace(user().user_id), row.storage_key).value[
            "content"
        ]
        == text
    )
    assert store.get(get_document_namespace("other-user"), row.storage_key) is None

    # Selection uses the same committed metadata and exact authenticated identity.
    async with sessions.begin() as session:
        selection = await services.DocumentService(
            DocumentRepository(session)
        ).resolve_selected_documents(user(), [metadata.id])
    assert selection.documents == (metadata,)


@pytest.mark.asyncio
async def test_safe_namespace_encoding_does_not_change_catalog_owner(ingestion):
    service, sessions, store, _ = ingestion
    owner = user("user/with*characters")
    metadata = await service.ingest_document(owner, upload())
    assert sessions.rows()[0].user_id == owner.user_id
    assert store.get(
        get_document_namespace(owner.user_id), get_document_storage_key(metadata.id)
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "file, error",
    [
        (upload(filename=""), services.InvalidDocumentUploadError),
        (upload(filename="x" * 256), services.InvalidDocumentUploadError),
        (upload(body=b""), services.InvalidDocumentUploadError),
        (upload(size=100), services.DocumentSizeExceededError),
        (upload(body=b"a" * 17), services.DocumentSizeExceededError),
        (upload(body=b"a" * 17, size=1), services.DocumentSizeExceededError),
    ],
)
async def test_upload_validation_precedes_reservation(ingestion, file, error):
    service, sessions, _, parser = ingestion
    service.settings = DocumentConfig(MAX_UPLOAD_BYTES=16)
    with pytest.raises(error):
        await service.ingest_document(user(), file)
    assert sessions.rows() == []
    assert sessions.phases == 0
    parser.parse.assert_not_awaited()


@pytest.mark.asyncio
async def test_disabled_parser_and_exact_upload_byte_boundary(ingestion, monkeypatch):
    service, sessions, _, parser = ingestion
    monkeypatch.setattr(services, "get_parser", lambda: None)
    with pytest.raises(services.DocumentProcessingDisabledError):
        await service.ingest_document(user(), upload())
    assert sessions.phases == 0
    monkeypatch.setattr(services, "get_parser", lambda: parser)
    service.settings = DocumentConfig(MAX_UPLOAD_BYTES=16)
    metadata = await service.ingest_document(user(), upload(body=b"a" * 16))
    assert metadata.original_size == 16


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text, error",
    [
        ("", services.EmptyDocumentExtractionError),
        (" \t\r\n", services.EmptyDocumentExtractionError),
        (None, services.InvalidDocumentTextError),
        ("text\x00", services.InvalidDocumentTextError),
        ("bad\ud800", services.InvalidDocumentTextError),
        ("a" * 17, services.DocumentSizeExceededError),
        ("é" * 9, services.DocumentSizeExceededError),
    ],
)
async def test_invalid_extraction_releases_capacity(ingestion, text, error):
    service, sessions, store, parser = ingestion
    service.settings = DocumentConfig(MAX_TEXT_BYTES=16)
    parser.parse.return_value = text
    with pytest.raises(error):
        await service.ingest_document(user(), upload())
    assert sessions.rows() == []
    assert store.search(get_document_namespace(user().user_id)) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mime", ["application/vnd.ms-excel", "image/tiff", "application/octet-stream", ""]
)
async def test_format_support_is_delegated_to_parser(ingestion, mime):
    service, sessions, _, parser = ingestion
    file = upload(mime=mime, filename="source.data")
    metadata = await service.ingest_document(user(), file)
    parser.parse.assert_awaited_once_with(file)
    assert sessions.rows()[0].status == "ready"
    assert metadata.mime_type == (mime or "application/octet-stream")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {
            "results": [
                {
                    "content": "",
                    "mime_type": "application/pdf",
                    "metadata": {"page_count": 3},
                    "extraction_method": "native",
                }
            ],
            "errors": [],
            "summary": {"inputs": 1, "results": 1, "errors": 0},
        },
        {
            "results": [{"content": " \t\n", "quality_score": 1.0}],
            "errors": [],
            "summary": {"inputs": 1, "results": 1, "errors": 0},
        },
        {
            "results": [],
            "errors": [],
            "summary": {"inputs": 1, "results": 0, "errors": 0},
        },
        [{"content": "", "mime_type": "application/pdf"}],
    ],
    ids=[
        "scanned_pdf_without_text",
        "whitespace_despite_quality_score",
        "no_results",
        "legacy_empty_content",
    ],
)
async def test_empty_xberg_response_releases_reservation(
    ingestion, monkeypatch, payload
):
    service, sessions, store, _ = ingestion
    settings = services.get_settings().model_copy(
        update={"XBERG_URL": "http://xberg.test"}
    )
    monkeypatch.setattr(xberg, "get_settings", lambda: settings)
    parser = xberg.XbergBackend()
    monkeypatch.setattr(services, "get_parser", lambda: parser)
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    monkeypatch.setattr(
        xberg.httpx, "AsyncClient", lambda: client_type(transport=transport)
    )
    with pytest.raises(services.EmptyDocumentExtractionError, match="no usable text"):
        await service.ingest_document(user(), upload())
    assert sessions.rows() == []
    assert store.search(get_document_namespace(user().user_id)) == []


@pytest.mark.asyncio
async def test_exact_extracted_byte_boundary(ingestion):
    service, _, _, parser = ingestion
    service.settings = DocumentConfig(MAX_TEXT_BYTES=16)
    parser.parse.return_value = "é" * 8
    metadata = await service.ingest_document(user(), upload())
    assert metadata.text_length == 8


@pytest.mark.asyncio
async def test_eleventh_upload_does_not_parse_or_evict(ingestion):
    service, sessions, _, parser = ingestion
    ids = [(await service.ingest_document(user(), upload())).id for _ in range(10)]
    with pytest.raises(DocumentQuotaExceededError):
        await service.ingest_document(user(), upload())
    assert parser.parse.await_count == 10
    assert {row.id for row in sessions.rows()} == set(ids)
    assert all(row.status == "ready" for row in sessions.rows())


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error_type",
    [RuntimeError, httpx.ConnectError, httpx.ReadTimeout, asyncio.CancelledError],
)
async def test_parser_errors_and_cancellation_compensate(ingestion, error_type):
    service, sessions, _, parser = ingestion
    parser.parse.side_effect = error_type("parser interrupted")
    with pytest.raises(error_type, match="parser interrupted"):
        await service.ingest_document(user(), upload())
    assert sessions.rows() == []


@pytest.mark.asyncio
async def test_anyio_level_cancellation_shields_compensation(ingestion):
    service, sessions, _, parser = ingestion
    with anyio.CancelScope() as scope:

        async def parse(_):
            scope.cancel()
            await anyio.sleep(0)

        parser.parse.side_effect = parse
        await service.ingest_document(user(), upload())
    assert scope.cancelled_caught
    assert sessions.rows() == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure",
    [
        "before_write",
        "after_write",
        "error_result",
        "ready_false",
        "ready_commit",
        "ready_ambiguous_commit",
        "reservation_commit",
        "reservation_ambiguous_commit",
    ],
)
async def test_storage_and_finalization_failures_compensate(
    ingestion, monkeypatch, failure
):
    service, sessions, store, parser = ingestion
    real_backend = create_document_backend(user().user_id)

    async def write(path, text):
        assert sessions.active == 0
        assert sessions.rows()[0].status == "processing"
        if failure == "before_write":
            raise RuntimeError("write failed")
        result = await real_backend.awrite(path, text)
        if failure == "after_write":
            raise asyncio.CancelledError("write interrupted after storage")
        if failure == "error_result":
            result.error = "storage unavailable"
        return result

    monkeypatch.setattr(
        services,
        "create_document_backend",
        lambda _: MagicMock(awrite=AsyncMock(side_effect=write)),
    )
    if failure == "ready_false":
        monkeypatch.setattr(
            DocumentRepository, "mark_ready", AsyncMock(return_value=False)
        )
    if "commit" in failure:
        sessions.fail_commit = 1 if failure.startswith("reservation") else 2
        sessions.ambiguous_commit = "ambiguous" in failure
    with pytest.raises((RuntimeError, asyncio.CancelledError)):
        await service.ingest_document(user(), upload())
    assert sessions.rows() == []
    assert store.search(get_document_namespace(user().user_id)) == []
    if failure.startswith("reservation"):
        parser.parse.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_body_cleanup_retains_tracking_and_slot_then_retry_frees_it(
    ingestion, monkeypatch
):
    service, sessions, store, _ = ingestion
    monkeypatch.setattr(DocumentRepository, "mark_ready", AsyncMock(return_value=False))
    real_delete = InMemoryStore.adelete
    monkeypatch.setattr(
        InMemoryStore,
        "adelete",
        AsyncMock(side_effect=RuntimeError("delete unavailable")),
    )
    with pytest.raises(services.DocumentStorageError, match="marked ready"):
        await service.ingest_document(user(), upload())
    row = sessions.rows()[0]
    assert row.status == "deleting" and row.slot == 0
    assert store.get(get_document_namespace(user().user_id), row.storage_key)
    async with sessions.begin() as session:
        assert (
            await DocumentRepository(session).get_ready_documents(
                user().user_id, [row.id]
            )
            == []
        )
        replacement = await DocumentRepository(session).reserve_document(
            user().user_id,
            filename="next.pdf",
            mime_type="application/pdf",
            original_size=1,
        )
        assert replacement.slot == 1
        replacement_id = replacement.id
    monkeypatch.setattr(InMemoryStore, "adelete", real_delete)
    await service._compensate(user().user_id, row.id, True)
    await service._compensate(
        user().user_id, row.id, True
    )  # Idempotent when already absent.
    assert [item.id for item in sessions.rows()] == [replacement_id]
    assert store.get(get_document_namespace(user().user_id), row.storage_key) is None


@pytest.mark.parametrize(
    "text",
    ["hello world " * 500, "é🙂漢字" * 500, "<|endoftext|>" * 500, "longline" * 10000],
    ids=["ordinary", "unicode", "special_tokens", "long_line"],
)
def test_excerpt_is_a_unicode_safe_bounded_prefix(text):
    settings = DocumentConfig(PREVIEW_TOKENS=17, PREVIEW_MAX_CHARS=90)
    excerpt = services.create_initial_excerpt(text, settings)
    assert excerpt and text.startswith(excerpt)
    assert len(excerpt) <= 90
    assert len(tiktoken.get_encoding("cl100k_base").encode_ordinary(excerpt)) <= 17


def test_excerpt_fallback_when_tokenizer_unavailable(monkeypatch):
    monkeypatch.setitem(sys.modules, "tiktoken", None)
    text = "é🙂漢字" * 100
    settings = DocumentConfig(PREVIEW_TOKENS=17, PREVIEW_MAX_CHARS=90)
    excerpt = services.create_initial_excerpt(text, settings)
    assert excerpt and text.startswith(excerpt)
    assert len(excerpt.encode("utf-8")) <= 17


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "phase, status, body_present", [(3, "processing", True), (4, "deleting", False)]
)
async def test_catalog_cleanup_failure_keeps_a_recoverable_row(
    ingestion, monkeypatch, phase, status, body_present
):
    service, sessions, store, _ = ingestion
    monkeypatch.setattr(DocumentRepository, "mark_ready", AsyncMock(return_value=False))
    sessions.fail_commit = phase
    with pytest.raises(services.DocumentStorageError, match="marked ready"):
        await service.ingest_document(user(), upload())
    row = sessions.rows()[0]
    assert row.status == status and row.slot == 0
    assert (
        bool(store.get(get_document_namespace(user().user_id), row.storage_key))
        == body_present
    )
    await service._compensate(user().user_id, row.id, True)
    assert sessions.rows() == []
    assert store.search(get_document_namespace(user().user_id)) == []


def test_excerpt_fallback_when_tokenizer_data_cannot_load(monkeypatch):
    monkeypatch.setattr(
        tiktoken, "get_encoding", MagicMock(side_effect=OSError("offline"))
    )
    text = "é🙂漢字" * 100
    excerpt = services.create_initial_excerpt(text, DocumentConfig(PREVIEW_TOKENS=17))
    assert excerpt and text.startswith(excerpt)
    assert len(excerpt.encode("utf-8")) <= 17
