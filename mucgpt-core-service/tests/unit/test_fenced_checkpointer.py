"""Unit tests for FencedPostgresSaver fence semantics (no real database needed).

The happy paths run against real PostgreSQL in the lifecycle tests
(tests/integration/test_conversation_lifecycle_postgres.py). These tests pin
the rejection behavior: every operation must refuse to touch a conversation
whose ownership row is missing or retired, and uncoordinated deletion and
unscoped listing must be impossible.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from database.fenced_checkpointer import (
    ConversationDeletedError,
    FencedPostgresSaver,
)

CONFIG = {"configurable": {"thread_id": "conv-1"}}


class _FakeResult:
    def __init__(self, row):
        self._row = row

    async def fetchone(self):
        return self._row


class _AsyncContext:
    """Minimal reusable async context manager."""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *exc_info):
        return False


def _make_saver(row):
    """A FencedPostgresSaver whose pool returns one connection with a mocked result row."""
    connection = MagicMock()
    connection.execute = AsyncMock(return_value=_FakeResult(row))
    connection.transaction = MagicMock(return_value=_AsyncContext(None))
    pool = MagicMock()
    pool.connection = MagicMock(return_value=_AsyncContext(connection))
    return FencedPostgresSaver(conn=pool), connection


@pytest.mark.asyncio
async def test_aget_tuple_rejects_missing_ownership_row():
    saver, _ = _make_saver(row=None)

    with pytest.raises(ConversationDeletedError):
        await saver.aget_tuple(CONFIG)


@pytest.mark.asyncio
async def test_aput_rejects_missing_ownership_row():
    saver, _ = _make_saver(row=None)

    with pytest.raises(ConversationDeletedError):
        await saver.aput(CONFIG, checkpoint=MagicMock(), metadata={}, new_versions={})


@pytest.mark.asyncio
async def test_aput_writes_rejects_missing_ownership_row():
    saver, _ = _make_saver(row=None)

    with pytest.raises(ConversationDeletedError):
        await saver.aput_writes(CONFIG, writes=[], task_id="task-1")


@pytest.mark.asyncio
async def test_alist_rejects_missing_ownership_row():
    saver, _ = _make_saver(row=None)

    with pytest.raises(ConversationDeletedError):
        async for _ in saver.alist(CONFIG):
            pass


@pytest.mark.asyncio
async def test_alist_denies_unscoped_listing():
    saver, connection = _make_saver(row=("conv-1",))

    with pytest.raises(ValueError):
        async for _ in saver.alist(None):
            pass

    connection.execute.assert_not_called()


@pytest.mark.asyncio
async def test_live_saver_locks_live_ownership_row(monkeypatch):
    """A live conversation is fenced with a SHARE lock bound to one connection."""
    saver, connection = _make_saver(row=("conv-1",))
    expected = object()
    inner_saver = MagicMock(aget_tuple=AsyncMock(return_value=expected))
    monkeypatch.setattr(
        "database.fenced_checkpointer.AsyncPostgresSaver",
        MagicMock(return_value=inner_saver),
    )

    connection.execute.assert_not_called()
    assert await saver.aget_tuple(CONFIG) is expected
    inner_saver.aget_tuple.assert_awaited_once_with(CONFIG)

    fence_call = connection.execute.call_args_list[0]
    assert "FOR SHARE" in fence_call.args[0]
    assert "deleted_at IS NULL" in fence_call.args[0]
    assert fence_call.args[1] == ("conv-1",)


@pytest.mark.asyncio
async def test_adelete_thread_is_rejected():
    """Erasure must go through PersistanceHelpers.erase_conversation, never raw."""
    saver, _ = _make_saver(row=("conv-1",))

    with pytest.raises(RuntimeError, match="PersistanceHelpers.erase_conversation"):
        await saver.adelete_thread("conv-1")
