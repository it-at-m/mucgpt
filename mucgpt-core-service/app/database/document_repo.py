from collections.abc import Sequence
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.virtual_file_system_helper import (
    get_document_namespace,
    get_document_storage_key,
)
from database.database_models import Document

DOCUMENT_LIMIT = 10


class DocumentQuotaExceededError(ValueError):
    """All ten catalog slots are occupied for this owner."""


class DocumentRepository:
    """Owner-scoped catalog operations; the caller owns the transaction.

    No method commits or touches stored bodies. Keep reservation transactions
    short and commit before parsing. Mark ready only after a successful file
    write. Deleting rows retain their slot until the caller completes cleanup.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def reserve_document(
        self, user_id: str, *, filename: str, mime_type: str, original_size: int
    ) -> Document:
        """Allocate a server UUID and a slot using database uniqueness arbitration.

        The unique (user_id, slot) index also indexes ownership. Concurrent
        instances cannot allocate the same slot; no count-then-insert is used.
        """
        get_document_namespace(user_id)
        if original_size < 0:
            raise ValueError("Original size must be nonnegative")
        document_id = str(uuid4())
        for slot in range(DOCUMENT_LIMIT):
            result = await self.session.execute(
                insert(Document)
                .values(
                    id=document_id,
                    user_id=user_id,
                    slot=slot,
                    filename=filename,
                    mime_type=mime_type,
                    original_size=original_size,
                    storage_key=get_document_storage_key(document_id),
                    status="processing",
                )
                .on_conflict_do_nothing(
                    index_elements=[Document.user_id, Document.slot]
                )
                .returning(Document)
            )
            document = result.scalar_one_or_none()
            if document is not None:
                return document
        raise DocumentQuotaExceededError("Document library limit of 10 reached")

    async def list_documents(self, user_id: str) -> list[Document]:
        """Return only this owner's metadata, including pending lifecycle states."""
        get_document_namespace(user_id)
        result = await self.session.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.created_at, Document.id)
            .execution_options(populate_existing=True)
        )
        return list(result.scalars().all())

    async def get_ready_documents(
        self, user_id: str, document_ids: Sequence[str]
    ) -> list[Document]:
        """Missing, foreign, processing, and deleting IDs are all unavailable."""
        get_document_namespace(user_id)
        ids = [str(UUID(document_id)) for document_id in document_ids]
        if not ids:
            return []
        result = await self.session.execute(
            select(Document)
            .where(
                Document.user_id == user_id,
                Document.id.in_(ids),
                Document.status == "ready",
            )
            .execution_options(populate_existing=True)
        )
        return list(result.scalars().all())

    async def get_document(self, user_id: str, document_id: str) -> Document | None:
        """Return owned lifecycle metadata; foreign and missing IDs are indistinguishable."""
        get_document_namespace(user_id)
        result = await self.session.execute(
            select(Document)
            .where(Document.user_id == user_id, Document.id == str(UUID(document_id)))
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def mark_ready(
        self, user_id: str, document_id: str, *, text_length: int, preview: str
    ) -> bool:
        """Finalize owned processing metadata after the caller has stored the body."""
        get_document_namespace(user_id)
        if text_length <= 0 or not isinstance(preview, str):
            raise ValueError("Ready documents require nonempty text and an excerpt")
        result = await self.session.execute(
            update(Document)
            .where(
                Document.id == str(UUID(document_id)),
                Document.user_id == user_id,
                Document.status == "processing",
            )
            .values(
                status="ready",
                text_length=text_length,
                preview=preview,
                preview_kind="initial_excerpt",
            )
            .returning(Document.id)
        )
        return result.scalar_one_or_none() is not None

    async def mark_deleting(
        self, user_id: str, document_id: str, *, allow_processing: bool = True
    ) -> bool:
        """Make owned metadata unavailable before cleanup; retryable on failure."""
        get_document_namespace(user_id)
        statement = update(Document).where(
            Document.id == str(UUID(document_id)), Document.user_id == user_id
        )
        if not allow_processing:
            # Public deletion must not release capacity while ingestion can still write.
            statement = statement.where(Document.status.in_(("ready", "deleting")))
        result = await self.session.execute(
            statement.values(status="deleting").returning(Document.id)
        )
        return result.scalar_one_or_none() is not None

    async def remove_after_cleanup(self, user_id: str, document_id: str) -> bool:
        """Free an owned deleting slot after storage cleanup, including failed uploads."""
        get_document_namespace(user_id)
        result = await self.session.execute(
            delete(Document)
            .where(
                Document.id == str(UUID(document_id)),
                Document.user_id == user_id,
                Document.status == "deleting",
            )
            .returning(Document.id)
        )
        return result.scalar_one_or_none() is not None
