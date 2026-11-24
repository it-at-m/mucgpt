from contextlib import asynccontextmanager
from uuid import UUID

import psycopg
from anyio import CancelScope, fail_after
from psycopg.errors import ConnectionTimeout, QueryCanceled
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# Bounds connecting and the non-blocking lock query of the dedicated lock session.
# keep it a constant to avoid overengineering; 
# no other db connection timeout is configurable
LOCK_TIMEOUT_SECONDS = 10


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
    # Shielded so a cancelled caller cannot leak a half-opened connection, and
    # bounded so an unreachable database cannot hang the shielded connect forever.
    with CancelScope(shield=True):
        try:
            with fail_after(LOCK_TIMEOUT_SECONDS):
                connection = await psycopg.AsyncConnection.connect(
                    host=url.host,
                    port=url.port,
                    dbname=url.database,
                    user=url.username,
                    password=url.password,
                    autocommit=True,
                    connect_timeout=LOCK_TIMEOUT_SECONDS,
                    options=(
                        "-c application_name=mucgpt-document-lock "
                        f"-c statement_timeout={LOCK_TIMEOUT_SECONDS * 1000}"
                    ),
                )
        except ConnectionTimeout as exc:
            raise TimeoutError("Document work lock connection timed out") from exc
    try:
        try:
            with fail_after(LOCK_TIMEOUT_SECONDS):
                cursor = await connection.execute(
                    "SELECT pg_try_advisory_lock(hashtextextended(%s, 0))", (key,)
                )
        except QueryCanceled as exc:
            # Only statement_timeout cancels statements on this private session.
            raise TimeoutError("Document work lock query timed out") from exc
        row = await cursor.fetchone()
        if row is None:  # a SELECT always yields a row; fail loudly if not
            raise RuntimeError("Advisory lock query returned no row")
        yield row[0]
    finally:
        # close() is synchronous in psycopg (PQfinish), so it cannot stall; ending
        # the session is what releases the session-level advisory lock.
        with CancelScope(shield=True):
            await connection.close()
