from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
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


def _message_content(message: HumanMessage | AIMessage) -> str:
    """Flatten LangChain text content into the public chat representation."""
    if isinstance(message.content, str):
        return message.content
    return "".join(
        block if isinstance(block, str) else str(block.get("text", ""))
        for block in message.content
        if isinstance(block, str) or block.get("type") == "text"
    )


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

        # LangGraph owns message storage. This is the only application table.
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
        checkpoint = await PersistanceHelpers.get_checkpointer().aget(
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
        pool = PersistanceHelpers._pool
        if pool is None:
            raise RuntimeError("PersistanceHelpers not initialized")
        async with pool.connection() as conn:
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
    async def is_user_in_conversation(user_id: str, conversation_id: str) -> bool:
        """Check ownership without creating a conversation."""
        pool = PersistanceHelpers._pool
        if pool is None:
            raise RuntimeError("PersistanceHelpers not initialized")
        async with pool.connection() as conn:
            cur = await conn.execute(
                "SELECT 1 FROM chats WHERE conversation_id = %s AND user_id = %s",
                (conversation_id, user_id),
            )
            return await cur.fetchone() is not None

    @staticmethod
    async def get_conversation_messages(
        conversation_id: str,
    ) -> list[ChatCompletionMessage]:
        """Read the displayable user/assistant chain from LangGraph state."""
        checkpoint = await PersistanceHelpers.get_checkpointer().aget(
            {"configurable": {"thread_id": conversation_id}}
        )
        if checkpoint is None:
            return []

        messages = checkpoint.get("channel_values", {}).get("messages", [])
        result: list[ChatCompletionMessage] = []
        for message in messages:
            if isinstance(message, HumanMessage):
                result.append(
                    ChatCompletionMessage(
                        role="user", content=_message_content(message)
                    )
                )
            elif isinstance(message, AIMessage) and not message.tool_calls:
                content = _message_content(message)
                if content:
                    result.append(
                        ChatCompletionMessage(role="assistant", content=content)
                    )
        return result
