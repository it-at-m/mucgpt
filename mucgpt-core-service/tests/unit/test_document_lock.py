import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import URL

from database.document_lock import document_work_lock


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "acquired, failure", [(True, False), (False, False), (True, True)]
)
async def test_lock_uses_unpooled_autocommit_session_and_closes_on_all_exits(
    monkeypatch, acquired, failure
):
    connection = MagicMock(
        execute=AsyncMock(
            return_value=MagicMock(fetchone=AsyncMock(return_value=(acquired,)))
        ),
        close=AsyncMock(),
    )
    connect = AsyncMock(return_value=connection)
    monkeypatch.setattr(
        "database.document_lock.psycopg.AsyncConnection.connect", connect
    )
    url = URL.create(
        "postgresql+asyncpg",
        username="user",
        password="secret",
        host="db",
        port=5432,
        database="catalog",
    )
    factory = MagicMock(kw={"bind": MagicMock(url=url)})
    document_id = str(uuid4())
    try:
        async with document_work_lock(factory, document_id.upper()) as result:
            assert result is acquired
            if failure:
                raise asyncio.CancelledError()
    except asyncio.CancelledError:
        assert failure
    connect.assert_awaited_once_with(
        host="db",
        port=5432,
        dbname="catalog",
        user="user",
        password="secret",
        autocommit=True,
    )
    connection.execute.assert_awaited_once_with(
        "SELECT pg_try_advisory_lock(hashtextextended(%s, 0))",
        ("mucgpt-document:" + document_id,),
    )
    connection.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_acquisition_error_closes_connection(monkeypatch):
    connection = MagicMock(
        execute=AsyncMock(side_effect=RuntimeError("database disconnected")),
        close=AsyncMock(),
    )
    monkeypatch.setattr(
        "database.document_lock.psycopg.AsyncConnection.connect",
        AsyncMock(return_value=connection),
    )
    factory = MagicMock(kw={"bind": MagicMock(url=URL.create("postgresql+asyncpg"))})
    with pytest.raises(RuntimeError, match="disconnected"):
        async with document_work_lock(factory, str(uuid4())):
            pytest.fail("An unsuccessful acquisition must not run document work")
    connection.close.assert_awaited_once()
