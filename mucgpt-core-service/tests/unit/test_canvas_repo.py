from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.dialects import postgresql

from database.canvas_repo import CanvasRepository


def _compiled(statement, literal_binds: bool = True) -> str:
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": literal_binds},
        )
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upsert_canvas_overwrites_content_only() -> None:
    session = AsyncMock()
    repository = CanvasRepository(session)

    await repository.upsert_canvas("conversation", "# Title")

    sql = _compiled(session.execute.await_args.args[0])
    assert "INSERT INTO canvas_documents" in sql
    assert "ON CONFLICT (conversation_id) DO UPDATE" in sql
    assert "content = excluded.content" in sql
    assert "updated_at = now()" in sql
    assert "revisions" not in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upsert_canvas_revisions_overwrites_rings_wholesale() -> None:
    session = AsyncMock()
    repository = CanvasRepository(session)

    await repository.upsert_canvas_revisions(
        "conversation", {"auto": [], "manual": [{"revision": 1}]}
    )

    sql = _compiled(session.execute.await_args.args[0], literal_binds=False)
    assert "ON CONFLICT (conversation_id) DO UPDATE" in sql
    assert "revisions = excluded.revisions" in sql
    assert "updated_at = now()" in sql
    assert "content = excluded.content" not in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_canvas_returns_whether_a_row_existed() -> None:
    session = AsyncMock()
    session.execute.return_value = Mock(
        scalar_one_or_none=Mock(return_value="conversation")
    )
    repository = CanvasRepository(session)

    assert await repository.delete_canvas("conversation")

    sql = _compiled(session.execute.await_args.args[0])
    assert "DELETE FROM canvas_documents" in sql
    assert "canvas_documents.conversation_id = 'conversation'" in sql
    assert "RETURNING canvas_documents.conversation_id" in sql
