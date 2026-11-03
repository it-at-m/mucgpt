from contextlib import asynccontextmanager
from uuid import UUID

import psycopg
from anyio import CancelScope
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@asynccontextmanager
async def document_work_lock(
    session_factory: async_sessionmaker[AsyncSession], document_id: str
):
    """Coordinate workers without expiring live work or holding a transaction.

    A dedicated, unpooled PostgreSQL session owns the advisory lock until close,
    including after process death. It cannot exhaust the catalog transaction pool
    or return a session-level lock to that pool. UUID hash collisions only serialize
    unrelated work; they never permit concurrent work on the same document.
    """
    url = session_factory.kw["bind"].url
    key = "mucgpt-document:" + str(UUID(document_id))
    with CancelScope(shield=True):
        connection = await psycopg.AsyncConnection.connect(
            host=url.host,
            port=url.port,
            dbname=url.database,
            user=url.username,
            password=url.password,
            autocommit=True,
        )
    try:
        cursor = await connection.execute(
            "SELECT pg_try_advisory_lock(hashtextextended(%s, 0))", (key,)
        )
        row = await cursor.fetchone()
        yield row[0]
    finally:
        with CancelScope(shield=True):
            await connection.close()
