from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .database_models import CanvasDocument


class CanvasRepository:
    """Database operations for canvas documents.

    The client owns all FIFO/cap logic for the revision rings; the server only
    stores the blobs.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_canvas(self, conversation_id: str) -> CanvasDocument | None:
        result = await self.session.execute(
            select(CanvasDocument).where(
                CanvasDocument.conversation_id == conversation_id
            )
        )
        return result.scalar_one_or_none()

    async def upsert_canvas(self, conversation_id: str, content: str) -> None:
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
        self, conversation_id: str, revisions: dict
    ) -> None:
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
