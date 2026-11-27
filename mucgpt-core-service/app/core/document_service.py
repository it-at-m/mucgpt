import asyncio
from collections.abc import AsyncGenerator, Generator, Sequence
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from datetime import datetime
from time import monotonic
from typing import Any
from uuid import UUID, uuid4

from anyio import CancelScope, current_effective_deadline, fail_after, to_thread
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config.settings import DocumentConfig, get_settings
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.virtual_file_system_helper import (
    create_document_backend,
    delete_document_body,
    get_document_path,
    get_document_storage_key,
)
from database.database_models import Document
from database.document_catalog import DocumentCatalogManager
from database.document_lock import document_work_lock
from database.document_repo import DOCUMENT_LIMIT, DocumentRepository
from parsing.factory import get_parser

logger = getLogger()

# Strong references keep late-write cleanups alive until they finish.
_background_tasks: set[asyncio.Task[None]] = set()


class InvalidDocumentUploadError(ValueError):
    """The filename or upload body is invalid."""


class DocumentSizeExceededError(ValueError):
    """The upload or extracted text exceeds its configured byte bound."""


class InvalidDocumentTextError(ValueError):
    """Extraction produced empty or invalid UTF-8 text."""


class EmptyDocumentExtractionError(InvalidDocumentTextError):
    """No usable text was extracted; keep distinct for future UX error mapping.

    Image-only/scanned PDFs without OCR are one possible cause, not a diagnosis
    that can be established from an empty response alone.
    """


class DocumentProcessingDisabledError(RuntimeError):
    """No extraction backend is configured."""


class DocumentStorageError(RuntimeError):
    """The body write or catalog finalization did not succeed."""


class DocumentOperationTimeoutError(RuntimeError):
    """A bounded document operation did not complete in time."""


@asynccontextmanager
async def document_deadline(timeout: float, operation: str) -> AsyncGenerator[None]:
    """Bound a whole document operation and report expiry as a public error."""
    try:
        with fail_after(timeout):
            yield
    except TimeoutError as exc:
        # Name the inner phase (e.g. the work lock) when it carries its own budget.
        phase = getattr(exc, "phase", operation)
        logger.warning(
            "Document %s timed out after %.2fs", phase, getattr(exc, "timeout", timeout)
        )
        raise DocumentOperationTimeoutError(f"Document {phase} timed out.") from exc


@contextmanager
def shielded_within_deadline() -> Generator[None]:
    """Ignore outer cancellation (e.g. a client disconnect) but keep the deadline.

    A shield alone would also hide the operation deadline and could hang forever.
    """
    with CancelScope(shield=True, deadline=current_effective_deadline()) as scope:
        yield
    # The scope swallows its own expiry; never let the caller continue as if done.
    if scope.cancelled_caught:
        raise TimeoutError


def create_initial_excerpt(text: str, settings: DocumentConfig) -> str:
    """Return first N characters of the document text to inject into system prompt"""
    return text[: settings.preview_max_chars]


class InvalidDocumentSelectionError(ValueError):
    """A selection contains invalid IDs or exceeds the library limit."""


class DocumentUnavailableError(ValueError):
    """An explicit selection includes an unavailable document, without owner details."""


class DocumentProcessingError(ValueError):
    """Public deletion cannot interrupt processing or another active document operation."""


@dataclass(frozen=True)
class SelectedDocument:
    id: str
    filename: str
    mime_type: str
    original_size: int
    text_length: int
    preview: str
    preview_kind: str
    path: str
    created_at: datetime


@dataclass(frozen=True)
class DocumentSelection:
    documents: tuple[SelectedDocument, ...]
    unavailable_ids: tuple[str, ...]

    @property
    def document_ids(self) -> tuple[str, ...]:
        return tuple(document.id for document in self.documents)

    @property
    def allowed_paths(self) -> tuple[str, ...]:
        return tuple(document.path for document in self.documents)


@dataclass(frozen=True)
class LibraryDocument:
    id: str
    filename: str
    mime_type: str
    original_size: int
    text_length: int | None
    preview: str | None
    preview_kind: str | None
    path: str
    status: str
    created_at: datetime


def _selected_document(row: Document) -> SelectedDocument:
    """Build the selected-document contract from a ready catalog row."""
    if row.text_length is None or row.preview is None or row.preview_kind is None:
        raise DocumentStorageError("Ready document metadata is incomplete")
    return SelectedDocument(
        id=row.id,
        filename=row.filename,
        mime_type=row.mime_type,
        original_size=row.original_size,
        text_length=row.text_length,
        preview=row.preview,
        preview_kind=row.preview_kind,
        path=get_document_path(row.id),
        created_at=row.created_at,
    )


class DocumentLibraryService:
    """User library operations with independently owned catalog sessions."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None = None):
        self.session_factory = (
            session_factory
            if session_factory is not None
            else DocumentCatalogManager.get_session_factory()
        )

    async def list_documents(
        self, user_info: AuthenticationResult
    ) -> list[LibraryDocument]:
        """List metadata in catalog order without accessing filesystem bodies."""
        async with self.session_factory() as session:
            rows = await DocumentRepository(session).list_documents(user_info.user_id)
            return [
                LibraryDocument(
                    id=row.id,
                    filename=row.filename,
                    mime_type=row.mime_type,
                    original_size=row.original_size,
                    text_length=row.text_length,
                    preview=row.preview,
                    preview_kind=row.preview_kind,
                    path=get_document_path(row.id),
                    status=row.status,
                    created_at=row.created_at,
                )
                for row in rows
            ]

    async def delete_document(
        self, user_info: AuthenticationResult, document_id: str
    ) -> None:
        """Hide -> delete exact body -> free slot, retaining deleting rows on failure."""
        document_id = str(UUID(document_id))
        started_at = monotonic()
        # Finish an authorized deletion even if its HTTP caller disconnects.
        with CancelScope(shield=True):
            async with document_deadline(
                get_settings().documents.deletion_timeout, "deletion"
            ):
                # Check ownership before attempting a lock, so foreign IDs remain
                # unavailable even when their workers are active.
                async with self.session_factory() as session:
                    document = await DocumentRepository(session).get_document(
                        user_info.user_id, document_id
                    )
                    if document is None:
                        raise DocumentUnavailableError("Document is unavailable.")

                async with document_work_lock(
                    self.session_factory, document_id
                ) as acquired:
                    if not acquired:
                        raise DocumentProcessingError(
                            "Document is busy. Retry deletion."
                        )
                    async with self.session_factory.begin() as session:
                        repository = DocumentRepository(session)
                        # Recheck after acquisition: another worker may have finished.
                        document = await repository.get_document(
                            user_info.user_id, document_id
                        )
                        if document is None:
                            raise DocumentUnavailableError("Document is unavailable.")
                        if document.storage_key != get_document_storage_key(
                            document_id
                        ):
                            raise DocumentStorageError(
                                "Document storage key is inconsistent"
                            )
                        # Ingestion holds this lock for its whole lifetime, so a
                        # processing row seen here is stale (e.g. worker crashed).
                        if not await repository.mark_deleting(
                            user_info.user_id, document_id, allow_processing=True
                        ):
                            raise DocumentUnavailableError("Document is unavailable.")

                    # No database transaction spans the store operation. Missing bodies are
                    # already cleaned up, so retries use the same idempotent exact-key delete.
                    await delete_document_body(user_info.user_id, document_id)
                    async with self.session_factory.begin() as session:
                        await DocumentRepository(session).remove_after_cleanup(
                            user_info.user_id, document_id
                        )
        logger.info("Document deletion completed in %.2fs", monotonic() - started_at)


class DocumentIngestionService:
    """Ingest using server authentication and independently committed catalog phases.

    Does not commit a selection repository's caller-owned session. Original files
    remain caller-owned and are never persisted. Accepted extraction is stored
    verbatim: no stripping, line wrapping, or newline/Unicode normalization.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        settings: DocumentConfig | None = None,
    ):
        self.session_factory = (
            session_factory
            if session_factory is not None
            else DocumentCatalogManager.get_session_factory()
        )
        self.settings = settings if settings is not None else get_settings().documents

    async def ingest_document(
        self, user_info: AuthenticationResult, file: UploadFile
    ) -> SelectedDocument:
        """Reserve -> parse -> validate/excerpt -> store -> publish ready metadata.

        Exceptions from the existing parser retain their type for future HTTP
        mapping. Cancellation is compensated too. Cleanup failure retains a
        tracked, capacity-occupying row and logs its ID for later reconciliation.
        """
        filename = file.filename
        if not filename or not filename.strip() or len(filename) > 255:
            raise InvalidDocumentUploadError(
                "A filename of at most 255 characters is required"
            )
        # Xberg owns supported-format detection. Browser MIME types may be absent,
        # generic, or inaccurate; retain them for display rather than reject files.
        mime_type = (file.content_type or "").split(";", 1)[0].strip().lower()
        mime_type = mime_type or "application/octet-stream"
        if file.size is not None and file.size > self.settings.max_upload_bytes:
            raise DocumentSizeExceededError("Document upload exceeds the byte limit")
        parser = get_parser()
        if parser is None:
            raise DocumentProcessingDisabledError("Document processing is not enabled")
        started_at = monotonic()
        reserved_id = str(uuid4())
        # One deadline covers the whole upload; compensation gets cleanup_timeout
        # on top so a timed-out upload can still free its slot.
        async with document_deadline(self.settings.ingestion_timeout, "ingestion"):
            original_size = await self._validate_upload_size(file)
            # Acquire before publishing processing metadata; keep ownership through
            # finalization or compensation, including failed/cancelled uploads.
            async with document_work_lock(
                self.session_factory, reserved_id
            ) as acquired:
                if not acquired:
                    raise DocumentStorageError(
                        "Document work lock could not be acquired"
                    )
                document_id = None
                write_attempted = False
                write_task: asyncio.Task[Any] | None = None
                try:
                    # Shield reservation publication so cancellation cannot lose a committed
                    # row's ID before compensation can identify it. The ID is set before
                    # commit, so a deadline hit during commit is still compensated.
                    with shielded_within_deadline():
                        async with self.session_factory.begin() as session:
                            document = await DocumentRepository(
                                session
                            ).reserve_document(
                                user_info.user_id,
                                filename=filename,
                                mime_type=mime_type,
                                original_size=original_size,
                                document_id=reserved_id,
                            )
                            document_id = document.id
                            created_at = document.created_at

                    if document_id is None:
                        raise DocumentStorageError(
                            "Document reservation was not published"
                        )

                    text = await parser.parse(file)
                    self._validate_text(text)
                    preview = await to_thread.run_sync(
                        create_initial_excerpt, text, self.settings
                    )
                    backend = create_document_backend(user_info.user_id)
                    write_attempted = True
                    write_task = asyncio.create_task(
                        backend.awrite(get_document_storage_key(document_id), text)
                    )
                    # AsyncPostgresStore queues writes internally. Shield the child
                    # task so the deadline cannot lose track of a queued write which
                    # may still reach storage after cancellation.
                    result = await asyncio.shield(write_task)
                    if result.error:
                        raise DocumentStorageError("Document body could not be stored")

                    # Construct metadata before publication: no fallible work after commit.
                    metadata = SelectedDocument(
                        id=document_id,
                        filename=filename,
                        mime_type=mime_type,
                        original_size=original_size,
                        text_length=len(text),
                        preview=preview,
                        preview_kind="initial_excerpt",
                        path=get_document_path(document_id),
                        created_at=created_at,
                    )
                    with shielded_within_deadline():
                        async with self.session_factory.begin() as session:
                            if not await DocumentRepository(session).mark_ready(
                                user_info.user_id,
                                document_id,
                                text_length=len(text),
                                preview=preview,
                            ):
                                raise DocumentStorageError(
                                    "Document could not be marked ready"
                                )
                    logger.info(
                        "Document ingestion completed in %.2fs",
                        monotonic() - started_at,
                    )
                    return metadata
                except BaseException:
                    write_pending = write_task is not None and not write_task.done()
                    if document_id is not None:
                        with CancelScope(shield=True):
                            try:
                                with fail_after(self.settings.cleanup_timeout):
                                    await self._compensate(
                                        user_info.user_id,
                                        document_id,
                                        write_attempted,
                                        write_pending=write_pending,
                                    )
                            except Exception:
                                logger.exception(
                                    "Document ingestion cleanup failed for %s",
                                    document_id,
                                )
                        if write_pending:
                            assert write_task is not None
                            self._schedule_late_write_cleanup(
                                user_info.user_id, document_id, write_task
                            )
                    raise

    async def _validate_upload_size(self, file: UploadFile) -> int:
        """Count with bounded reads even when the supplied size is absent/inaccurate.

        Rewind for the existing parser, which reads the full accepted upload.
        This bounds service/parser reads, not the HTTP server's multipart spool.
        """
        await file.seek(0)
        size = 0
        try:
            while chunk := await file.read(
                min(64 * 1024, self.settings.max_upload_bytes - size + 1)
            ):
                size += len(chunk)
                if size > self.settings.max_upload_bytes:
                    raise DocumentSizeExceededError(
                        "Document upload exceeds the byte limit"
                    )
        finally:
            await file.seek(0)
        if size == 0:
            raise InvalidDocumentUploadError("Document upload is empty")
        return size

    def _validate_text(self, text: str) -> None:
        if not isinstance(text, str):
            raise InvalidDocumentTextError("Document extraction must return text")
        if not text.strip():
            raise EmptyDocumentExtractionError(
                "Document extraction returned no usable text"
            )
        if "\x00" in text:
            raise InvalidDocumentTextError(
                "Document extraction must not contain NUL characters"
            )
        if len(text) > self.settings.max_text_bytes:
            raise DocumentSizeExceededError("Extracted text exceeds the byte limit")
        try:
            size = len(text.encode("utf-8"))
        except UnicodeEncodeError:
            raise InvalidDocumentTextError(
                "Document extraction must be valid UTF-8 text"
            ) from None
        if size > self.settings.max_text_bytes:
            raise DocumentSizeExceededError("Extracted text exceeds the byte limit")

    async def _compensate(
        self,
        user_id: str,
        document_id: str,
        write_attempted: bool,
        *,
        write_pending: bool = False,
    ) -> None:
        # First hide even an ambiguously committed ready row. Never free capacity
        # before an uncertain/partial write has been deleted successfully.
        async with self.session_factory.begin() as session:
            await DocumentRepository(session).mark_deleting(user_id, document_id)
        if write_pending:
            # The queued store write may still land after this point. Retain the
            # deleting row (and its quota slot) until the late-write cleanup deletes
            # the exact key and can safely free the row.
            return
        if write_attempted:
            await delete_document_body(user_id, document_id)
        async with self.session_factory.begin() as session:
            await DocumentRepository(session).remove_after_cleanup(user_id, document_id)

    def _schedule_late_write_cleanup(
        self, user_id: str, document_id: str, write_task: asyncio.Task[Any]
    ) -> None:
        """Delete a queued write only after it can no longer recreate its body."""

        async def cleanup() -> None:
            try:
                await asyncio.shield(write_task)
            except BaseException:
                # A failed write needs the same catalog cleanup as a successful late
                # write: its exact key might have been written before the failure.
                logger.debug(
                    "Late document write settled with an error for %s", document_id
                )
            try:
                with (
                    CancelScope(shield=True),
                    fail_after(self.settings.cleanup_timeout),
                ):
                    await self._compensate(user_id, document_id, True)
            except BaseException:
                # Keep the deleting row for an operator/retry instead of freeing its
                # slot while a body may remain.
                logger.exception(
                    "Late document write cleanup failed for %s", document_id
                )

        task = asyncio.create_task(
            cleanup(), name=f"document-late-write-cleanup-{document_id}"
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)


class DocumentService:
    """Resolve IDs using identity supplied by the existing authenticate_user flow."""

    def __init__(self, repository: DocumentRepository):
        self.repository = repository

    async def resolve_selected_documents(
        self,
        user_info: AuthenticationResult,
        document_ids: Sequence[str],
        *,
        saved_selection: bool = False,
    ) -> DocumentSelection:
        """Revalidate each turn, preserving order after canonicalization/deduplication.

        Explicit invalid/unavailable selections fail as a unit. Saved selections
        keep ready attachments and report missing/foreign/non-ready IDs uniformly
        as unavailable; those IDs never become allowed filesystem paths.
        """
        if isinstance(document_ids, str | bytes) or not isinstance(
            document_ids, Sequence
        ):
            raise InvalidDocumentSelectionError(
                "Document selection must be a list of IDs"
            )
        ids = []
        for document_id in document_ids:
            try:
                if not isinstance(document_id, str):
                    raise ValueError
                canonical_id = str(UUID(document_id))
            except ValueError:
                raise InvalidDocumentSelectionError(
                    "Document selection must contain UUID IDs"
                ) from None
            if canonical_id not in ids:
                ids.append(canonical_id)
            if len(ids) > DOCUMENT_LIMIT:
                raise InvalidDocumentSelectionError("Select at most 10 documents")

        rows = await self.repository.get_ready_documents(user_info.user_id, ids)
        ready = {
            row.id: row
            for row in rows
            if row.storage_key == get_document_storage_key(row.id)
        }
        unavailable = tuple(
            document_id for document_id in ids if document_id not in ready
        )
        if unavailable and not saved_selection:
            raise DocumentUnavailableError(
                "One or more selected documents are unavailable"
            )
        documents = tuple(
            _selected_document(row)
            for document_id in ids
            if (row := ready.get(document_id)) is not None
        )
        return DocumentSelection(documents=documents, unavailable_ids=unavailable)
