import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from psycopg.errors import QueryCanceled
from sqlalchemy import URL

from database.document_lock import (
    LOCK_TIMEOUT_SECONDS,
    DocumentLockTimeoutError,
    document_work_lock,
)


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
        connect_timeout=10,
        options="-c application_name=mucgpt-document-lock -c statement_timeout=10000",
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


@pytest.mark.asyncio
async def test_statement_timeout_becomes_a_timeout_and_closes_connection(monkeypatch):
    # Match by error class, not by the server's (locale-dependent) message text.
    connection = MagicMock(
        execute=AsyncMock(side_effect=QueryCanceled("Anweisung storniert")),
        close=AsyncMock(),
    )
    monkeypatch.setattr(
        "database.document_lock.psycopg.AsyncConnection.connect",
        AsyncMock(return_value=connection),
    )
    factory = MagicMock(kw={"bind": MagicMock(url=URL.create("postgresql+asyncpg"))})
    with pytest.raises(DocumentLockTimeoutError, match="work-lock query"):
        async with document_work_lock(factory, str(uuid4())):
            pytest.fail("A timed-out acquisition must not run document work")
    connection.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_connect_timeout_includes_the_lock_phase_and_budget(monkeypatch):
    monkeypatch.setattr(
        "database.document_lock.psycopg.AsyncConnection.connect",
        AsyncMock(side_effect=TimeoutError()),
    )
    factory = MagicMock(kw={"bind": MagicMock(url=URL.create("postgresql+asyncpg"))})

    with pytest.raises(DocumentLockTimeoutError) as error:
        async with document_work_lock(factory, str(uuid4())):
            pytest.fail("Timed-out lock acquisition must not run document work")

    assert error.value.phase == "work-lock connection"
    assert error.value.timeout == LOCK_TIMEOUT_SECONDS
