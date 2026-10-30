from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .database_models import CanvasDocument, Chat


class CanvasRepository:
    """Database operations for canvas documents.

    The client owns all FIFO/cap logic for the revision rings; the server only
    stores the blobs.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def lock_live_canvas_access(self, conversation_id: str, user_id: str) -> bool:
        """Share-lock the conversation's live ownership row.

        A concurrent ``erase_conversation`` takes FOR UPDATE on the same row, so
        this lock serializes ownership changes against the write: either the
        share lock sees a live row and the write commits before the erasure, or
        the erasure committed first and the write is skipped — a canvas row
        must never (re)appear for a retired conversation.
        """
        result = await self.session.execute(
            select(Chat.conversation_id)
            .where(
                Chat.conversation_id == conversation_id,
                Chat.user_id == user_id,
                Chat.deleted_at.is_(None),
            )
            .with_for_update(read=True)
        )
        return result.scalar_one_or_none() is not None

    async def get_canvas(self, conversation_id: str) -> CanvasDocument | None:
        result = await self.session.execute(
            select(CanvasDocument).where(
                CanvasDocument.conversation_id == conversation_id
            )
        )
        return result.scalar_one_or_none()

    async def upsert_canvas(
        self, conversation_id: str, content: str, user_id: str
    ) -> None:
        if not await self.lock_live_canvas_access(conversation_id, user_id):
            return
        statement = insert(CanvasDocument).values(
            conversation_id=conversation_id,
            content=content,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[CanvasDocument.conversation_id],
            set_={"content": statement.excluded.content, "updated_at": func.now()},
        )
        await self.session.execute(statement)

    async def get_canvas_revisions(self, conversation_id: str) -> dict | None:
        result = await self.session.execute(
            select(CanvasDocument.revisions).where(
                CanvasDocument.conversation_id == conversation_id
            )
        )
        return result.scalar_one_or_none()

    async def upsert_canvas_revisions(
        self, conversation_id: str, revisions: dict, user_id: str
    ) -> None:
        if not await self.lock_live_canvas_access(conversation_id, user_id):
            return
        statement = insert(CanvasDocument).values(
            conversation_id=conversation_id,
            content="",
            revisions=revisions,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[CanvasDocument.conversation_id],
            set_={
                "revisions": statement.excluded.revisions,
                "updated_at": func.now(),
            },
        )
        await self.session.execute(statement)

    async def delete_canvas(self, conversation_id: str) -> bool:
        result = await self.session.execute(
            delete(CanvasDocument)
            .where(CanvasDocument.conversation_id == conversation_id)
            .returning(CanvasDocument.conversation_id)
        )
        return result.scalar_one_or_none() is not None
