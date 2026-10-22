from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.dialects import postgresql

from core.persistance_helpers import PersistanceHelpers
from database.canvas_repo import CanvasRepository
from database.conversation_repo import ConversationRepository


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


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_conversation_with_canvas_deletes_both_in_one_transaction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    transaction = AsyncMock()
    transaction.__aenter__.return_value = session
    transaction.__aexit__.return_value = False
    factory = Mock()
    factory.begin.return_value = transaction
    monkeypatch.setattr(
        PersistanceHelpers, "_get_session_factory", Mock(return_value=factory)
    )

    async def fake_mapping_delete(self, conversation_id, user_id):
        assert self.session is session
        return True

    async def fake_canvas_delete(self, conversation_id):
        assert self.session is session

    monkeypatch.setattr(
        ConversationRepository, "delete_conversation_mapping", fake_mapping_delete
    )
    monkeypatch.setattr(CanvasRepository, "delete_canvas", fake_canvas_delete)

    assert await PersistanceHelpers.delete_conversation_with_canvas(
        "conversation", "owner"
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_canvas_delete_failure_rolls_back_conversation_delete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Both rows must survive a failed canvas delete, or the canvas row is
    orphaned personal data with no reachable deletion path."""
    session = AsyncMock()
    transaction = AsyncMock()
    transaction.__aenter__.return_value = session
    transaction.__aexit__.return_value = False
    factory = Mock()
    factory.begin.return_value = transaction
    monkeypatch.setattr(
        PersistanceHelpers, "_get_session_factory", Mock(return_value=factory)
    )

    async def fake_mapping_delete(self, conversation_id, user_id):
        return True

    async def failing_canvas_delete(self, conversation_id):
        raise RuntimeError("db down")

    monkeypatch.setattr(
        ConversationRepository, "delete_conversation_mapping", fake_mapping_delete
    )
    monkeypatch.setattr(CanvasRepository, "delete_canvas", failing_canvas_delete)

    with pytest.raises(RuntimeError):
        await PersistanceHelpers.delete_conversation_with_canvas(
            "conversation", "owner"
        )

    transaction.__aexit__.assert_awaited_once()
    exc_type, exc, _ = transaction.__aexit__.await_args.args
    assert exc_type is RuntimeError
    assert exc is not None
