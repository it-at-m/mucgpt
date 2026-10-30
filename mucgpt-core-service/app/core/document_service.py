from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from core.auth_models import AuthenticationResult
from core.virtual_file_system_helper import get_document_path, get_document_storage_key
from database.document_repo import DOCUMENT_LIMIT, DocumentRepository


class InvalidDocumentSelectionError(ValueError):
    """A selection contains invalid IDs or exceeds the library limit."""


class DocumentUnavailableError(ValueError):
    """An explicit selection includes an unavailable document, without owner details."""


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
            SelectedDocument(
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
            for document_id in ids
            if (row := ready.get(document_id)) is not None
        )
        return DocumentSelection(documents=documents, unavailable_ids=unavailable)
