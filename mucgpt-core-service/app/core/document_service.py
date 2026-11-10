from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from anyio import CancelScope, to_thread
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


def create_initial_excerpt(text: str, settings: DocumentConfig) -> str:
    """Return first N characters of the document text to inject into system prompt"""
    candidate = text[: settings.PREVIEW_MAX_CHARS]
    return candidate

    # idea: use tiktoken to enforce an actual token limit instead of just a character limit
    # usefulness is questinable, but it is a more accurate representation of what the model will see
    try:
        import tiktoken

        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = encoding.encode_ordinary(candidate)
        excerpt = encoding.decode_bytes(tokens[: settings.PREVIEW_TOKENS]).decode(
            "utf-8", errors="ignore"
        )
        # Trimming an incomplete UTF-8 sequence may change boundary tokenization.
        while (
            excerpt and len(encoding.encode_ordinary(excerpt)) > settings.PREVIEW_TOKENS
        ):
            excerpt = excerpt[:-1]
        return excerpt
    except Exception:
        return candidate.encode("utf-8")[: settings.PREVIEW_TOKENS].decode(
            "utf-8", errors="ignore"
        )


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
        # Finish an authorized deletion even if its HTTP caller disconnects.
        with CancelScope(shield=True):
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
                    raise DocumentProcessingError("Document is busy. Retry deletion.")
                async with self.session_factory.begin() as session:
                    repository = DocumentRepository(session)
                    # Recheck after acquisition: another worker may have finished.
                    document = await repository.get_document(
                        user_info.user_id, document_id
                    )
                    if document is None:
                        raise DocumentUnavailableError("Document is unavailable.")
                    if document.storage_key != get_document_storage_key(document_id):
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
        if file.size is not None and file.size > self.settings.MAX_UPLOAD_BYTES:
            raise DocumentSizeExceededError("Document upload exceeds the byte limit")
        parser = get_parser()
        if parser is None:
            raise DocumentProcessingDisabledError("Document processing is not enabled")
        original_size = await self._validate_upload_size(file)

        reserved_id = str(uuid4())
        # Acquire before publishing processing metadata; keep ownership through
        # finalization or compensation, including failed/cancelled uploads.
        async with document_work_lock(self.session_factory, reserved_id) as acquired:
            if not acquired:
                raise DocumentStorageError("Document work lock could not be acquired")
            document_id = None
            write_attempted = False
            try:
                # Shield reservation publication so cancellation cannot lose a committed
                # row's ID before compensation can identify it.
                with CancelScope(shield=True):
                    async with self.session_factory.begin() as session:
                        document = await DocumentRepository(session).reserve_document(
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
                result = await backend.awrite(
                    get_document_storage_key(document_id), text
                )
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
                with CancelScope(shield=True):
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
                return metadata
            except BaseException:
                if document_id is not None:
                    with CancelScope(shield=True):
                        try:
                            await self._compensate(
                                user_info.user_id, document_id, write_attempted
                            )
                        except Exception:
                            logger.exception(
                                "Document ingestion cleanup failed for %s", document_id
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
                min(64 * 1024, self.settings.MAX_UPLOAD_BYTES - size + 1)
            ):
                size += len(chunk)
                if size > self.settings.MAX_UPLOAD_BYTES:
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
        if len(text) > self.settings.MAX_TEXT_BYTES:
            raise DocumentSizeExceededError("Extracted text exceeds the byte limit")
        try:
            size = len(text.encode("utf-8"))
        except UnicodeEncodeError:
            raise InvalidDocumentTextError(
                "Document extraction must be valid UTF-8 text"
            ) from None
        if size > self.settings.MAX_TEXT_BYTES:
            raise DocumentSizeExceededError("Extracted text exceeds the byte limit")

    async def _compensate(
        self, user_id: str, document_id: str, write_attempted: bool
    ) -> None:
        # First hide even an ambiguously committed ready row. Never free capacity
        # before an uncertain/partial write has been deleted successfully.
        async with self.session_factory.begin() as session:
            await DocumentRepository(session).mark_deleting(user_id, document_id)
        if write_attempted:
            await delete_document_body(user_id, document_id)
        async with self.session_factory.begin() as session:
            await DocumentRepository(session).remove_after_cleanup(user_id, document_id)


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
