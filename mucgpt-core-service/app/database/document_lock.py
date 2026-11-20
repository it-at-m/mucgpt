from contextlib import asynccontextmanager
from math import ceil
from time import monotonic
from uuid import UUID

import psycopg
from anyio import CancelScope, fail_after
from psycopg.errors import ConnectionTimeout, QueryCanceled
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config.settings import DocumentConfig, get_settings
from core.logtools import getLogger

logger = getLogger()


def _statement_timeout_error(error: QueryCanceled) -> bool:
    return error.diag.message_primary == "canceling statement due to statement timeout"


@asynccontextmanager
async def document_work_lock(
    session_factory: async_sessionmaker[AsyncSession],
    document_id: str,
    settings: DocumentConfig | None = None,
):
    """Coordinate workers without expiring live work or holding a transaction.

    A dedicated, unpooled PostgreSQL session owns the advisory lock until close,
    including after process death. It cannot exhaust the catalog transaction pool
    or return a session-level lock to that pool. UUID hash collisions only serialize
    unrelated work; they never permit concurrent work on the same document.
    """
    settings = settings if settings is not None else get_settings().documents
    started_at = monotonic()
    url = session_factory.kw["bind"].url
    key = "mucgpt-document:" + str(UUID(document_id))
    with CancelScope(shield=True):
        try:
            with fail_after(settings.lock_connect_timeout):
                connection = await psycopg.AsyncConnection.connect(
                    host=url.host,
                    port=url.port,
                    dbname=url.database,
                    user=url.username,
                    password=url.password,
                    autocommit=True,
                    connect_timeout=ceil(settings.lock_connect_timeout),
                    options=(
                        f"-c application_name=mucgpt-document-lock "
                        f"-c statement_timeout={ceil(settings.lock_query_timeout * 1000)}"
                    ),
                )
        except ConnectionTimeout as exc:
            raise TimeoutError("Document work lock connection timed out") from exc
    try:
        try:
            with fail_after(settings.lock_query_timeout):
                cursor = await connection.execute(
                    "SELECT pg_try_advisory_lock(hashtextextended(%s, 0))", (key,)
                )
        except QueryCanceled as exc:
            if not _statement_timeout_error(exc):
                raise
            raise TimeoutError("Document work lock query timed out") from exc
        row = await cursor.fetchone()
        if row is None:  # a SELECT always yields a row; fail loudly if not
            raise RuntimeError("Advisory lock query returned no row")
        logger.info(
            "Document work lock %s in %.2fs",
            "acquired" if row[0] else "unavailable",
            monotonic() - started_at,
        )
        yield row[0]
    finally:
        close_started_at = monotonic()
        try:
            with CancelScope(shield=True):
                with fail_after(settings.lock_close_timeout):
                    await connection.close()
        except BaseException:
            logger.exception("Document work lock connection close failed")
            raise
        else:
            logger.info(
                "Document work lock connection closed in %.2fs",
                monotonic() - close_started_at,
            )
