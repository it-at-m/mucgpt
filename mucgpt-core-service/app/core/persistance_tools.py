from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from core.logtools import getLogger

logger = getLogger()


# TODO: move to config/settings.py
DB_URI = "postgresql://admin:admin@checkpoint-postgres:5432/checkpoints"


def _content(message) -> str:
    """`message` is either a pydantic ChatCompletionMessage or a plain dict."""
    if isinstance(message, dict):
        return str(message.get("content", ""))
    return str(getattr(message, "content", message))


class PersistanceTools:
    _pool: AsyncConnectionPool | None = None
    _checkpointer: AsyncPostgresSaver | None = None

    @staticmethod
    async def init() -> None:
        if PersistanceTools._pool is not None:
            return
        pool = AsyncConnectionPool(
            conninfo=DB_URI,
            max_size=20,
            open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0},
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(conn=pool)
        await checkpointer.setup()  # creates LangGraph's checkpoint_* tables if missing

        # ensure tables for chats and messages exist
        await PersistanceTools._ensure_tables_exist(pool)

        PersistanceTools._pool = pool
        PersistanceTools._checkpointer = checkpointer
        logger.info("PersistanceTools initialized")

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
        if PersistanceTools._pool is not None:
            await PersistanceTools._pool.close()
            PersistanceTools._pool = None
            PersistanceTools._checkpointer = None

    @staticmethod
    def get_checkpointer() -> AsyncPostgresSaver:
        if PersistanceTools._checkpointer is None:
            raise RuntimeError("PersistanceTools not initialized")
        return PersistanceTools._checkpointer

    @staticmethod
    async def verify_user_in_conversation(user_id: str, conversation_id: str) -> bool:
        """True if the conversation belongs to `user_id`. First time a conversation_id
        is seen, create the chat row and return True (new chat)."""
        async with PersistanceTools._pool.connection() as conn:
            cur = await conn.execute(
                "SELECT user_id FROM chats WHERE conversation_id = %s",
                (conversation_id,),
            )
            row = await cur.fetchone()
            if row is None:
                await conn.execute(
                    "INSERT INTO chats (conversation_id, user_id) VALUES (%s, %s)",
                    (conversation_id, user_id),
                )
                return True
            return row[0] == user_id

    @staticmethod
    async def insert_message(
        user_id: str,
        conversation_id: str,
        message,
        message_type: str = "user",
    ) -> None:
        async with PersistanceTools._pool.connection() as conn:
            await conn.execute(
                "INSERT INTO messages (conversation_id, user_id, role, content) "
                "VALUES (%s, %s, %s, %s)",
                (conversation_id, user_id, message_type, _content(message)),
            )
