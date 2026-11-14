from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.database_models import Chat, ChatImage


@dataclass(frozen=True)
class ReservedImage:
    """Server-assigned identity captured before the session closes."""

    id: str
    created_at: datetime


class ImageUnavailableError(ValueError):
    """A referenced image is missing, foreign, expired, or deleting."""


class ImageAlreadyBoundError(ValueError):
    """A referenced image already belongs to a different conversation."""


class ImageConversationUnavailableError(ValueError):
    """The target conversation row is missing, foreign, or retired."""


def _as_utc(value: datetime) -> datetime:
    """SQLite-backed stores return naive timestamps; treat them as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _expired(expires_at: datetime | None) -> bool:
    return expires_at is not None and _as_utc(expires_at) <= datetime.now(UTC)


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

    async def bind_images_to_conversation(
        self, user_id: str, conversation_id: str, image_ids: list[str]
    ) -> int:
        """Bind unbound drafts to the conversation under the live-chat fence.

        Runs inside the caller's transaction. The live ``chats`` row is locked
        FOR SHARE (PostgreSQL) so concurrent conversation deletion cannot race
        the binding, and candidate image rows are locked FOR UPDATE in id
        order; SQLite (tests) silently omits unsupported lock modifiers.
        Rebinding an image to the same conversation is a no-op; binding it to
        a different conversation is rejected.
        """
        unique_ids = sorted(set(image_ids))
        if not unique_ids:
            return 0
        dialect = getattr(getattr(self.session, "bind", None), "dialect", None)
        locks_supported = dialect is not None and dialect.name == "postgresql"

        chat_lock = select(Chat.conversation_id).where(
            Chat.conversation_id == conversation_id,
            Chat.user_id == user_id,
            Chat.deleted_at.is_(None),
        )
        if locks_supported:
            # read=True renders FOR SHARE on PostgreSQL: concurrent deletes
            # (FOR UPDATE) conflict with the binding transaction.
            chat_lock = chat_lock.with_for_update(read=True)
        chat_row = (
            await self.session.execute(chat_lock)
        ).scalar_one_or_none()
        if chat_row is None:
            raise ImageConversationUnavailableError(
                "Conversation is not available for this user"
            )

        image_query = (
            select(ChatImage)
            .where(
                ChatImage.id.in_(unique_ids),
                ChatImage.owner_user_id == user_id,
            )
            .order_by(ChatImage.id)
        )
        if locks_supported:
            image_query = image_query.with_for_update()
        rows = (await self.session.execute(image_query)).scalars().all()
        by_id = {row.id: row for row in rows}
        for image_id in unique_ids:
            row = by_id.get(image_id)
            if row is None or row.status != "ready" or _expired(row.expires_at):
                raise ImageUnavailableError(
                    "One or more attached images are no longer available."
                )
            if row.conversation_id is None:
                row.conversation_id = conversation_id
                row.bound_at = datetime.now(UTC)
                row.expires_at = None
            elif row.conversation_id != conversation_id:
                raise ImageAlreadyBoundError(
                    "An attached image already belongs to another conversation."
                )
        return len(unique_ids)

    async def verify_unbound_images(
        self, user_id: str, image_ids: list[str]
    ) -> int:
        """Stateless requests: owned, ready, unexpired, and unbound images."""
        unique_ids = sorted(set(image_ids))
        if not unique_ids:
            return 0
        rows = (
            await self.session.execute(
                select(ChatImage).where(
                    ChatImage.id.in_(unique_ids),
                    ChatImage.owner_user_id == user_id,
                )
            )
        ).scalars().all()
        by_id = {row.id: row for row in rows}
        for image_id in unique_ids:
            row = by_id.get(image_id)
            if row is None or row.status != "ready" or _expired(row.expires_at):
                raise ImageUnavailableError(
                    "One or more attached images are no longer available."
                )
            if row.conversation_id is not None:
                raise ImageAlreadyBoundError(
                    "Stateless requests cannot reference conversation-bound images."
                )
        return len(unique_ids)
