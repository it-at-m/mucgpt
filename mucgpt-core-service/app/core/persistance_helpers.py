from typing import Any

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from api.api_models import ChatCompletionMessage
from config.settings import Settings
from core.logtools import getLogger

logger = getLogger()


def _create_connection_args(settings: Settings) -> dict[str, Any]:
    """Create PostgreSQL connection parameters from settings."""
    db = settings.DB
    return {
        "host": db.HOST,
        "port": db.PORT,
        "dbname": db.NAME,
        "user": db.USER,
        "password": db.PASSWORD.get_secret_value(),
        "autocommit": True,
        "prepare_threshold": 0,
        # Return rows as dicts so queries can read columns by name. The
        # AsyncPostgresSaver sets this on its own cursors regardless.
        "row_factory": dict_row,
    }


def _content(message: ChatCompletionMessage | dict[str, Any]) -> str:
    """`message` is either a pydantic ChatCompletionMessage or a plain dict."""
    if isinstance(message, dict):
        return str(message.get("content", ""))
    return str(getattr(message, "content", message))


class PersistanceHelpers:
    _pool: AsyncConnectionPool | None = None
    _checkpointer: AsyncPostgresSaver | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        if PersistanceHelpers._pool is not None:
            return
        pool = AsyncConnectionPool(
            conninfo="",
            max_size=20,
            open=False,
            kwargs=_create_connection_args(settings),
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(conn=pool)
        await checkpointer.setup()  # creates LangGraph's checkpoint_* tables if missing

        # ensure tables for chats and messages exist
        await PersistanceHelpers._ensure_tables_exist(pool)

        PersistanceHelpers._pool = pool
        PersistanceHelpers._checkpointer = checkpointer
        logger.info("PersistanceHelpers initialized")

    @staticmethod
    async def _ensure_tables_exist(pool: AsyncConnectionPool) -> None:
        async with pool.connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chats (
                    conversation_id TEXT PRIMARY KEY,
                    user_id         TEXT        NOT NULL,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """
            )
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    conversation_id TEXT        NOT NULL REFERENCES chats(conversation_id),
                    user_id         TEXT        NOT NULL,
                    role            TEXT        NOT NULL,   -- "user" | "assistant"
                    content         TEXT        NOT NULL,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """
            )

    @staticmethod
    async def close() -> None:
        if PersistanceHelpers._pool is not None:
            await PersistanceHelpers._pool.close()
            PersistanceHelpers._pool = None
            PersistanceHelpers._checkpointer = None

    @staticmethod
    def get_checkpointer() -> AsyncPostgresSaver:
        if PersistanceHelpers._checkpointer is None:
            raise RuntimeError("PersistanceHelpers not initialized")
        return PersistanceHelpers._checkpointer

    @staticmethod
    def get_checkpointer_if_ready() -> AsyncPostgresSaver | None:
        """Return the checkpointer, or ``None`` when persistence has not been
        initialised (e.g. in tests or when the feature is disabled)."""
        return PersistanceHelpers._checkpointer

    @staticmethod
    async def has_checkpoint(conversation_id: str) -> bool:
        """Return whether LangGraph already has state for this conversation."""
        checkpointer = PersistanceHelpers.get_checkpointer()
        checkpoint = await checkpointer.aget(
            {"configurable": {"thread_id": conversation_id}}
        )
        return checkpoint is not None

    @staticmethod
    async def verify_user_in_conversation(user_id: str, conversation_id: str) -> bool:
        """True if the conversation belongs to `user_id`. First time a conversation_id
        is seen, create the chat row and return True (new chat).

        The insert-or-ignore keeps concurrent first requests for the same
        conversation_id from creating duplicate ownership rows.
        """
        async with PersistanceHelpers._pool.connection() as conn:
            await conn.execute(
                "INSERT INTO chats (conversation_id, user_id) VALUES (%s, %s) "
                "ON CONFLICT (conversation_id) DO NOTHING",
                (conversation_id, user_id),
            )
            cur = await conn.execute(
                "SELECT user_id FROM chats WHERE conversation_id = %s",
                (conversation_id,),
            )
            row = await cur.fetchone()
            return row is not None and row["user_id"] == user_id

    @staticmethod
    async def insert_message(
        user_id: str,
        conversation_id: str,
        message: ChatCompletionMessage | dict[str, Any],
        message_type: str = "user",
    ) -> None:
        async with PersistanceHelpers._pool.connection() as conn:
            await conn.execute(
                "INSERT INTO messages (conversation_id, user_id, role, content) "
                "VALUES (%s, %s, %s, %s)",
                (conversation_id, user_id, message_type, _content(message)),
            )
