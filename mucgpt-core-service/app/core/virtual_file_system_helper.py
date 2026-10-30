from anyio import CancelScope
from langgraph.store.postgres import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool

from config.settings import Settings
from core.logtools import getLogger
from core.persistance_helpers import _create_connection_args

logger = getLogger()


class FileStoreManager:
    """Own the PostgreSQL store for documents shared across a user's chats."""

    _pool: AsyncConnectionPool | None = None
    _file_store: AsyncPostgresStore | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        """Publish the store only after setup succeeds; failed startup is retryable."""
        if FileStoreManager._pool is not None:
            return

        pool = AsyncConnectionPool(
            conninfo="",
            max_size=20,
            open=False,
            kwargs=_create_connection_args(settings),
        )
        try:
            await pool.open()
            store = AsyncPostgresStore(conn=pool)
            await store.setup()
        except BaseException:
            with CancelScope(shield=True):
                await pool.close()
            raise

        FileStoreManager._pool = pool
        FileStoreManager._file_store = store
        logger.info("FileStoreManager initialized")

    @staticmethod
    async def close() -> None:
        """Close the independently owned pool and clear store readiness."""
        pool = FileStoreManager._pool
        try:
            if pool is not None:
                await pool.close()
        finally:
            FileStoreManager._pool = None
            FileStoreManager._file_store = None

    @staticmethod
    def get_store() -> AsyncPostgresStore:
        """Return the document store, raising until initialization has succeeded."""
        if FileStoreManager._file_store is None:
            raise RuntimeError("FileStoreManager not initialized")
        return FileStoreManager._file_store
