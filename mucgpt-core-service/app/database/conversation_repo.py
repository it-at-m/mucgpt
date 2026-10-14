from __future__ import annotations

from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .database_models import Chat


class ConversationRepository:
    """Database operations for conversation ownership and metadata."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def verify_user_in_conversation(
        self, user_id: str, conversation_id: str
    ) -> bool:
        """Create a conversation for its owner, or refresh its activity timestamp."""
        statement = insert(Chat).values(
            conversation_id=conversation_id,
            user_id=user_id,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[Chat.conversation_id],
            set_={"updated_at": func.now()},
            where=Chat.user_id == statement.excluded.user_id,
        )
        await self.session.execute(statement)
        return await self.is_user_in_conversation(user_id, conversation_id)

    async def is_user_in_conversation(self, user_id: str, conversation_id: str) -> bool:
        result = await self.session.execute(
            select(Chat.conversation_id).where(
                Chat.conversation_id == conversation_id,
                Chat.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def get_conversations_for_user(self, user_id: str) -> list[dict[str, Any]]:
        result = await self.session.execute(
            select(
                Chat.conversation_id,
                Chat.chat_title.label("title"),
                Chat.created_at,
                Chat.updated_at,
            )
            .where(Chat.user_id == user_id)
            .order_by(Chat.updated_at.desc())
        )
        return [dict(row) for row in result.mappings().all()]

    async def conversation_exists(self, conversation_id: str) -> bool:
        result = await self.session.execute(
            select(Chat.conversation_id).where(Chat.conversation_id == conversation_id)
        )
        return result.scalar_one_or_none() is not None

    async def set_chat_title_for_conversation(
        self, conversation_id: str, user_id: str, title: str
    ) -> bool:
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
            where=Chat.user_id == statement.excluded.user_id,
        ).returning(Chat.conversation_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def delete_conversation_mapping(
        self, conversation_id: str, user_id: str
    ) -> bool:
        result = await self.session.execute(
            delete(Chat)
            .where(
                Chat.conversation_id == conversation_id,
                Chat.user_id == user_id,
            )
            .returning(Chat.conversation_id)
        )
        return result.scalar_one_or_none() is not None
