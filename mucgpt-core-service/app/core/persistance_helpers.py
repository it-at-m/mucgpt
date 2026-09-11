from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from api.api_models import ChatCompletionMessage
from config.settings import Settings
from core.logtools import getLogger
from database.conversation_repo import ConversationRepository
from database.database_models import Base
from database.session import create_engine_and_session_factory

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
    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker[AsyncSession] | None = None

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

        # LangGraph owns message storage. SQLAlchemy owns the application table.
        engine, session_factory = create_engine_and_session_factory(settings)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        PersistanceHelpers._pool = pool
        PersistanceHelpers._checkpointer = checkpointer
        PersistanceHelpers._engine = engine
        PersistanceHelpers._session_factory = session_factory
        logger.info("PersistanceHelpers initialized")

    @staticmethod
    async def close() -> None:
        if PersistanceHelpers._pool is not None:
            await PersistanceHelpers._pool.close()
            PersistanceHelpers._pool = None
            PersistanceHelpers._checkpointer = None
        if PersistanceHelpers._engine is not None:
            await PersistanceHelpers._engine.dispose()
            PersistanceHelpers._engine = None
            PersistanceHelpers._session_factory = None

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
        is seen, create the chat row and return True (new chat); on later calls by
        the owner, bump ``updated_at`` so it tracks last activity.

        The upsert keeps concurrent first requests for the same conversation_id
        from creating duplicate ownership rows, and the ``user_id`` guard on the
        conflict update stops a foreign conversation_id from being touched.
        """
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(session).verify_user_in_conversation(
                user_id, conversation_id
            )

    @staticmethod
    async def is_user_in_conversation(user_id: str, conversation_id: str) -> bool:
        """Check ownership without creating a conversation."""
        factory = PersistanceHelpers._get_session_factory()
        async with factory() as session:
            return await ConversationRepository(session).is_user_in_conversation(
                user_id, conversation_id
            )

    @staticmethod
    async def get_conversations_for_user(user_id: str) -> list[dict[str, Any]]:
        """Return the caller's conversations as metadata rows, most recently
        active first. Messages are not included; fetch those per conversation via
        the checkpointer.
        """
        factory = PersistanceHelpers._get_session_factory()
        async with factory() as session:
            return await ConversationRepository(session).get_conversations_for_user(
                user_id
            )

    @staticmethod
    async def conversation_exists(conversation_id: str) -> bool:
        """Check whether a conversation exists without checking its owner."""
        factory = PersistanceHelpers._get_session_factory()
        async with factory() as session:
            return await ConversationRepository(session).conversation_exists(
                conversation_id
            )

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

    @staticmethod
    async def set_chat_title_for_conversation(
        conversation_id: str, user_id: str, title: str
    ) -> bool:
        """Set the chat title for a conversation, creating the chat row if it does
        not exist yet.

        The ``ON CONFLICT`` update is scoped to the owning ``user_id`` so a caller
        cannot rename a conversation that belongs to someone else (the
        ``conversation_id`` is client-generated and therefore guessable).
        """
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(
                session
            ).set_chat_title_for_conversation(conversation_id, user_id, title)

    @staticmethod
    async def delete_conversation_mapping(conversation_id: str, user_id: str) -> bool:
        """Delete the conversation mapping row. Returns True if a row was deleted."""
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(session).delete_conversation_mapping(
                conversation_id, user_id
            )

    @staticmethod
    def _get_session_factory() -> async_sessionmaker[AsyncSession]:
        if PersistanceHelpers._session_factory is None:
            raise RuntimeError("PersistanceHelpers not initialized")
        return PersistanceHelpers._session_factory
