from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .database_models import Chat


class ConversationRepository:
    """Database operations for conversation ownership and metadata."""

    def __init__(self, session: AsyncSession):
        """Use the caller's session; transaction ownership remains with the caller."""
        self.session = session

    async def verify_user_in_conversation(
        self, user_id: str, conversation_id: str, assistant_id: str | None = None
    ) -> bool:
        """Claim a fresh ID or refresh a live owned row; reject foreign/retired IDs."""
        statement = insert(Chat).values(
            conversation_id=conversation_id,
            user_id=user_id,
            assistant_id=assistant_id,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[Chat.conversation_id],
            set_={
                "updated_at": func.now(),
                # Preserve the original association. Fill a missing one for
                # legacy conversations or rows created by title generation.
                "assistant_id": func.coalesce(
                    Chat.assistant_id, statement.excluded.assistant_id
                ),
            },
            where=(Chat.user_id == statement.excluded.user_id)
            & Chat.deleted_at.is_(None),
        )
        await self.session.execute(statement)
        return await self.is_user_in_conversation(user_id, conversation_id)

    async def is_user_in_conversation(self, user_id: str, conversation_id: str) -> bool:
        """Check live ownership without claiming, refreshing, or reviving an ID."""
        result = await self.session.execute(
            select(Chat.conversation_id).where(
                Chat.conversation_id == conversation_id,
                Chat.user_id == user_id,
                Chat.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none() is not None

    async def get_conversations_for_user(self, user_id: str) -> list[dict[str, Any]]:
        """List live metadata for one owner, ordered by descending activity time."""
        result = await self.session.execute(
            select(
                Chat.conversation_id,
                Chat.chat_title.label("title"),
                Chat.assistant_id,
                Chat.created_at,
                Chat.updated_at,
            )
            .where(Chat.user_id == user_id, Chat.deleted_at.is_(None))
            .order_by(Chat.updated_at.desc())
        )
        return [dict(row) for row in result.mappings().all()]

    async def conversation_exists(self, conversation_id: str) -> bool:
        """Report whether a live or retired ownership mapping exists for the ID."""
        result = await self.session.execute(
            select(Chat.conversation_id).where(Chat.conversation_id == conversation_id)
        )
        return result.scalar_one_or_none() is not None

    async def set_chat_title_for_conversation(
        self, conversation_id: str, user_id: str, title: str
    ) -> bool:
        """Create/title an owned live row; reject foreign ownership and retirement."""
        statement = insert(Chat).values(
            conversation_id=conversation_id,
            user_id=user_id,
            chat_title=title,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[Chat.conversation_id],
            set_={
                "chat_title": statement.excluded.chat_title,
                "updated_at": func.now(),
            },
            where=(Chat.user_id == statement.excluded.user_id)
            & Chat.deleted_at.is_(None),
        ).returning(Chat.conversation_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def delete_conversation_mapping(
        self, conversation_id: str, user_id: str
    ) -> bool:
        """Retire an owned mapping without erasing checkpoints or committing.

        This metadata-only operation does not establish completed erasure.
        Application deletion must use PersistanceHelpers.erase_conversation to
        coordinate checkpoint cleanup and retirement in the same transaction.
        """
        result = await self.session.execute(
            update(Chat)
            .values(deleted_at=func.now())
            .where(
                Chat.conversation_id == conversation_id,
                Chat.user_id == user_id,
            )
            .returning(Chat.conversation_id)
        )
        return result.scalar_one_or_none() is not None
