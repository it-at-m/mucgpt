from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.database_models import ChatImage


@dataclass(frozen=True)
class ReservedImage:
    """Server-assigned identity captured before the session closes."""

    id: str
    created_at: datetime


class ImageRepository:
    """Owner-scoped catalog operations; the caller owns the transaction.

    No method commits or touches stored bytes. Reservation happens before the
    upload so a crash after the PUT still leaves a row for reconciliation;
    ``mark_ready`` runs only after the object exists. Never expose bucket,
    object key, or checksum beyond service-internal use.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def reserve_image(
        self,
        user_id: str,
        *,
        filename: str,
        mime_type: str,
        size_bytes: int,
        sha256: str,
        bucket: str,
        object_key: str,
        width: int | None = None,
        height: int | None = None,
        image_id: str | None = None,
    ) -> ReservedImage:
        """Insert an ``uploading`` reservation row and return its identity."""
        if size_bytes < 0:
            raise ValueError("Image size must be nonnegative")
        image_id = str(UUID(image_id)) if image_id is not None else str(uuid4())
        result = await self.session.execute(
            insert(ChatImage)
            .values(
                id=image_id,
                owner_user_id=user_id,
                bucket=bucket,
                object_key=object_key,
                mime_type=mime_type,
                size_bytes=size_bytes,
                sha256=sha256,
                original_filename=filename,
                width=width,
                height=height,
                status="uploading",
            )
            .returning(ChatImage.id, ChatImage.created_at)
        )
        inserted = result.one()
        return ReservedImage(id=inserted.id, created_at=inserted.created_at)

    async def mark_ready(
        self, user_id: str, image_id: str, *, expires_at: datetime
    ) -> bool:
        """Publish a reservation after the object upload succeeded."""
        result = await self.session.execute(
            update(ChatImage)
            .values(status="ready", ready_at=datetime.now(UTC), expires_at=expires_at)
            .where(
                ChatImage.id == image_id,
                ChatImage.owner_user_id == user_id,
                ChatImage.status == "uploading",
            )
            .returning(ChatImage.id)
        )
        return result.scalar_one_or_none() is not None

    async def get_ready_image(self, user_id: str, image_id: str) -> ChatImage | None:
        """Return the owner's live ready image, or None for foreign/other rows."""
        result = await self.session.execute(
            select(ChatImage).where(
                ChatImage.id == image_id,
                ChatImage.owner_user_id == user_id,
                ChatImage.status == "ready",
            )
        )
        return result.scalar_one_or_none()

    async def delete_image(self, user_id: str, image_id: str) -> bool:
        """Drop a failed/unbound draft reservation after best-effort cleanup."""
        result = await self.session.execute(
            delete(ChatImage)
            .where(
                ChatImage.id == image_id,
                ChatImage.owner_user_id == user_id,
                ChatImage.conversation_id.is_(None),
            )
            .returning(ChatImage.id)
        )
        return result.scalar_one_or_none() is not None
