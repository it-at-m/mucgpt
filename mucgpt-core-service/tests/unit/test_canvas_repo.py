from unittest.mock import AsyncMock, Mock, patch

import pytest
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy.dialects import postgresql

from core.persistance_helpers import PersistanceHelpers
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

    await repository.upsert_canvas("conversation", "# Title", "owner")

    sql = _compiled(session.execute.await_args.args[0])
    # the content upsert must never touch the client-owned revision rings
    assert "revisions" not in sql
    assert "content = excluded.content" in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_upsert_canvas_revisions_overwrites_rings_wholesale() -> None:
    session = AsyncMock()
    repository = CanvasRepository(session)

    await repository.upsert_canvas_revisions(
        "conversation", {"auto": [], "manual": [{"revision": 1}]}, "owner"
    )

    sql = _compiled(session.execute.await_args.args[0], literal_binds=False)
    assert "revisions = excluded.revisions" in sql
    assert "content = excluded.content" not in sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_canvas_writes_share_lock_the_live_chat_row() -> None:
    """Canvas writes must conflict with erase_conversation's FOR UPDATE and be
    skipped when the conversation is retired or owned by someone else, so a
    canvas row can never (re)appear for an erased conversation."""
    session = AsyncMock()
    repository = CanvasRepository(session)

    await repository.upsert_canvas("conversation", "# Title", "owner")
    await repository.upsert_canvas_revisions("conversation", {"auto": []}, "owner")

    executed = session.execute.await_args_list
    assert len(executed) == 4  # two claims + two upserts
    claim_sql = _compiled(executed[0].args[0], literal_binds=False)
    assert "FOR SHARE" in claim_sql
    assert "chats" in claim_sql
    assert "deleted_at" in claim_sql


@pytest.mark.unit
@pytest.mark.asyncio
async def test_canvas_writes_skip_retired_or_foreign_conversations() -> None:
    session = AsyncMock()
    session.execute.return_value = Mock(scalar_one_or_none=Mock(return_value=None))
    repository = CanvasRepository(session)

    await repository.upsert_canvas("conversation", "# Title", "intruder")
    await repository.upsert_canvas_revisions("conversation", {"auto": []}, "intruder")

    executed = session.execute.await_args_list
    assert len(executed) == 2  # the claims ran; no upsert statement was built/executed
    assert all("INSERT" not in _compiled(call.args[0]) for call in executed)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_canvas_returns_whether_a_row_existed() -> None:
    session = AsyncMock()
    repository = CanvasRepository(session)

    session.execute.return_value = Mock(
        scalar_one_or_none=Mock(return_value="conversation")
    )
    assert await repository.delete_canvas("conversation")

    session.execute.return_value = Mock(scalar_one_or_none=Mock(return_value=None))
    assert not await repository.delete_canvas("conversation")


def _erase_harness(monkeypatch: pytest.MonkeyPatch) -> tuple[Mock, Mock]:
    """Pool mock exposing one transactional connection with a lockable row."""
    transaction = Mock()
    transaction.__aenter__ = AsyncMock(return_value=None)
    transaction.__aexit__ = AsyncMock(return_value=False)

    connection = Mock()
    connection.transaction = Mock(return_value=transaction)
    row = {"user_id": "owner", "deleted_at": None}
    fetch_result = Mock()
    fetch_result.fetchone = AsyncMock(return_value=row)
    connection.execute = AsyncMock(return_value=fetch_result)

    connection_ctx = Mock()
    connection_ctx.__aenter__ = AsyncMock(return_value=connection)
    connection_ctx.__aexit__ = AsyncMock(return_value=False)
    pool = Mock()
    pool.connection = Mock(return_value=connection_ctx)
    monkeypatch.setattr(PersistanceHelpers, "_pool", pool)
    return connection, transaction


@pytest.mark.unit
@pytest.mark.asyncio
async def test_erase_conversation_cascades_canvas_in_one_transaction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The canvas row is personal data: it must not outlive the conversation's
    retirement, and both changes commit in the same transaction."""
    connection, transaction = _erase_harness(monkeypatch)

    with patch.object(AsyncPostgresSaver, "adelete_thread", AsyncMock()) as eraser:
        assert (
            await PersistanceHelpers.erase_conversation("conversation", "owner")
            == "deleted"
        )

    executed = [call.args[0] for call in connection.execute.await_args_list]
    assert any("UPDATE chats" in sql for sql in executed)
    assert any("DELETE FROM canvas_documents" in sql for sql in executed)
    eraser.assert_awaited_once()
    transaction.__aexit__.assert_awaited_once_with(None, None, None)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_erase_conversation_failure_rolls_back_canvas_cascade(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failing erasure must roll back the canvas cascade too, or the canvas
    row is orphaned personal data with no reachable deletion path."""
    connection, transaction = _erase_harness(monkeypatch)

    with patch.object(
        AsyncPostgresSaver,
        "adelete_thread",
        AsyncMock(side_effect=RuntimeError("db down")),
    ):
        with pytest.raises(RuntimeError):
            await PersistanceHelpers.erase_conversation("conversation", "owner")

    transaction.__aexit__.assert_awaited_once()
    exc_type, exc, _ = transaction.__aexit__.await_args.args
    assert exc_type is RuntimeError
    assert exc is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_erase_conversation_for_foreign_owner_is_inert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A foreign owner must be rejected by the ownership check itself — before
    any destructive statement runs (the endpoint only propagates the verdict)."""
    connection, transaction = _erase_harness(monkeypatch)

    with patch.object(AsyncPostgresSaver, "adelete_thread", AsyncMock()) as eraser:
        assert (
            await PersistanceHelpers.erase_conversation("conversation", "intruder")
            == "forbidden"
        )

    executed = [call.args[0] for call in connection.execute.await_args_list]
    assert all("DELETE FROM" not in sql for sql in executed)
    assert all("UPDATE chats" not in sql for sql in executed)
    eraser.assert_not_awaited()
    transaction.__aexit__.assert_awaited_once_with(None, None, None)
