from __future__ import annotations

from typing import Any

from anyio import CancelScope
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from api.api_models import (
    ConversationActivityStep,
    ConversationMessage,
    ConversationUsage,
)
from config.settings import Settings, get_settings
from core.logtools import getLogger
from database.conversation_repo import ConversationRepository
from database.database_models import Base, Chat
from database.fenced_checkpointer import FencedPostgresSaver
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


def _display_text(value: Any, max_length: int) -> str | None:
    """Normalize and bound tool details for display, omitting nontext/empty values."""
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if not text:
        return None
    return text if len(text) <= max_length else text[: max_length - 1] + "…"


def _conversation_usage(message: AIMessage) -> ConversationUsage | None:
    """Restore turn usage, falling back to legacy context counts without inventing totals."""
    snapshot = message.response_metadata.get("mucgpt_usage")
    if isinstance(snapshot, dict):
        try:
            return ConversationUsage.model_validate(snapshot)
        except ValidationError:
            logger.warning("Ignoring invalid conversation usage snapshot")
    metadata = message.usage_metadata
    if not metadata:
        return None
    # Legacy checkpoints still carry the provider's latest context count.
    # Do not confuse a single call's usage with cumulative turn consumption.
    context_tokens = metadata.get("total_tokens")
    if context_tokens is None:
        context_tokens = metadata.get("input_tokens", 0) + metadata.get(
            "output_tokens", 0
        )
    usage = ConversationUsage(context_tokens=context_tokens)
    model_name = message.response_metadata.get("model_name")
    model = next(
        (model for model in get_settings().MODELS if model.llm_name == model_name), None
    )
    if model is not None:
        usage.usage_model = model.llm_name
        usage.usage_max_input_tokens = model.max_input_tokens
        usage.usage_context_warning_threshold_percent = (
            model.context_warning_threshold_percent
        )
        usage.usage_context_critical_threshold_percent = (
            model.context_critical_threshold_percent
        )
    return usage


class PersistanceHelpers:
    """Manage ownership metadata and fenced checkpoints for persisted conversations."""

    _pool: AsyncConnectionPool | None = None
    _checkpointer: AsyncPostgresSaver | None = None
    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker[AsyncSession] | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        """Open persistence and migrate legacy state before publishing ready resources.

        Failed initialization closes provisional resources and leaves startup retryable.
        All old, unfenced writers must be drained before this migration runs.
        """
        if PersistanceHelpers._pool is not None:
            return
        pool = AsyncConnectionPool(
            conninfo="",
            max_size=20,
            open=False,
            kwargs=_create_connection_args(settings),
        )
        engine, session_factory = create_engine_and_session_factory(settings)
        try:
            await pool.open()
            checkpointer = FencedPostgresSaver(conn=pool)
            await checkpointer.setup()
            await PersistanceHelpers._initialize_schema(pool, engine)
        except BaseException:
            with CancelScope(shield=True):
                await pool.close()
                await engine.dispose()
            raise

        PersistanceHelpers._pool = pool
        PersistanceHelpers._checkpointer = checkpointer
        PersistanceHelpers._engine = engine
        PersistanceHelpers._session_factory = session_factory
        logger.info("PersistanceHelpers initialized")

    @staticmethod
    async def _initialize_schema(
        pool: AsyncConnectionPool, engine: AsyncEngine
    ) -> None:
        """Migrate retirement metadata and quarantine/erase legacy orphan state."""
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all, tables=[Chat.__table__])

        # create_all does not alter existing tables. Keep the core's startup
        # migration idempotent and quarantine pre-fence orphan checkpoint IDs.
        async with pool.connection() as connection:
            async with connection.transaction():
                await connection.execute(
                    "ALTER TABLE chats ADD COLUMN IF NOT EXISTS deleted_at timestamptz"
                )
                await connection.execute(
                    "INSERT INTO chats (conversation_id, user_id, deleted_at) "
                    "SELECT thread_id, '', now() FROM ("
                    "SELECT thread_id FROM checkpoints UNION "
                    "SELECT thread_id FROM checkpoint_writes UNION "
                    "SELECT thread_id FROM checkpoint_blobs) AS legacy "
                    "ON CONFLICT (conversation_id) DO NOTHING"
                )
                # Unknown legacy owners cannot authorize cleanup through DELETE.
                # Startup owns that cleanup; failure aborts startup and retries
                # on the next initialization without serving unsafe mappings.
                for table in ("checkpoints", "checkpoint_writes", "checkpoint_blobs"):
                    await connection.execute(
                        f"DELETE FROM {table} WHERE thread_id IN "
                        "(SELECT conversation_id FROM chats WHERE user_id = '' AND deleted_at IS NOT NULL)"
                    )

    @staticmethod
    async def close() -> None:
        """Close initialized database resources and clear their readiness references."""
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
        """Return the fenced saver, raising if persistence is not initialized."""
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
    async def verify_user_in_conversation(
        user_id: str, conversation_id: str, assistant_id: str | None = None
    ) -> bool:
        """True if the conversation belongs to `user_id`. First time a conversation_id
        is seen, create the chat row and return True (new chat); on later calls by
        the owner, bump ``updated_at`` so it tracks last activity.

        The upsert keeps concurrent first requests for the same conversation_id
        from creating duplicate ownership rows, and the ``user_id`` guard on the
        conflict update stops a foreign conversation_id from being touched.
        Retired IDs always return False, including for their original owner.
        """
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(session).verify_user_in_conversation(
                user_id, conversation_id, assistant_id
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
        """Check for any ownership row, including a permanent retirement tombstone."""
        factory = PersistanceHelpers._get_session_factory()
        async with factory() as session:
            return await ConversationRepository(session).conversation_exists(
                conversation_id
            )

    @staticmethod
    async def get_conversation_messages(
        conversation_id: str,
    ) -> list[ConversationMessage]:
        """Read the displayable user/assistant chain from LangGraph state."""
        checkpoint = await PersistanceHelpers.get_checkpointer().aget(
            {"configurable": {"thread_id": conversation_id}}
        )
        if checkpoint is None:
            return []

        messages = checkpoint.get("channel_values", {}).get("messages", [])
        result: list[ConversationMessage] = []
        turn: ConversationMessage | None = None
        steps: dict[str, ConversationActivityStep] = {}
        for message in messages:
            if isinstance(message, AIMessage) and turn is not None:
                usage = _conversation_usage(message)
                if usage is not None:
                    turn.usage = usage
            if isinstance(message, HumanMessage):
                turn = ConversationMessage(
                    role="user", content=_message_content(message)
                )
                result.append(turn)
                steps = {}
            elif (
                isinstance(message, AIMessage)
                and message.tool_calls
                and turn is not None
            ):
                for call in message.tool_calls:
                    call_id = call.get("id")
                    if not call_id or call_id in steps:
                        continue
                    args = call.get("args") or {}
                    detail = next(
                        (
                            text
                            for key in ("query", "search_query", "q", "topic", "url")
                            if (text := _display_text(args.get(key), 120))
                        ),
                        None,
                    )
                    step = ConversationActivityStep(
                        tool_call_id=call_id,
                        tool_name=call["name"],
                        # A call without a result was interrupted, not still running
                        # in the browser loading this historical checkpoint.
                        status="error",
                        description=_display_text(args.get("status_message"), 80),
                        detail=detail,
                    )
                    steps[call_id] = step
                    turn.activity_steps.append(step)
            elif isinstance(message, ToolMessage) and message.tool_call_id in steps:
                failed = message.status == "error" or (
                    isinstance(message.content, str)
                    and message.content.startswith("Tool execution failed:")
                )
                steps[message.tool_call_id].status = "error" if failed else "done"
            elif isinstance(message, AIMessage) and not message.tool_calls:
                content = _message_content(message)
                if content:
                    result.append(
                        ConversationMessage(role="assistant", content=content)
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
        Retired IDs cannot be renamed or revived, even by their original owner.
        """
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(
                session
            ).set_chat_title_for_conversation(conversation_id, user_id, title)

    @staticmethod
    async def rename_conversation(
        conversation_id: str, user_id: str, title: str
    ) -> bool:
        """Commit a manual title change only for an existing live owned row."""
        factory = PersistanceHelpers._get_session_factory()
        async with factory.begin() as session:
            return await ConversationRepository(session).rename_conversation(
                conversation_id, user_id, title
            )

    @staticmethod
    async def delete_conversation_mapping(conversation_id: str, user_id: str) -> bool:
        """Erase and retire the ID; ownership mappings must never be removed alone."""
        return (
            await PersistanceHelpers.erase_conversation(conversation_id, user_id)
            == "deleted"
        )

    @staticmethod
    async def erase_conversation(conversation_id: str, user_id: str) -> str:
        """Erase checkpoints and retire the ID under the ownership row's UPDATE lock.

        Return ``deleted`` only after commit, ``missing`` for an absent row, or
        ``forbidden`` for another owner. Owner retries repeat physical cleanup.
        Any erasure failure rolls back and propagates, retaining protected state
        for retry. Tombstones prevent ID reuse and must not be purged.
        """
        pool = PersistanceHelpers._pool
        if pool is None:
            raise RuntimeError("Persistence not initialized")
        async with pool.connection() as connection:
            async with connection.transaction():
                result = await connection.execute(
                    "SELECT user_id, deleted_at FROM chats WHERE conversation_id = %s FOR UPDATE",
                    (conversation_id,),
                )
                row = await result.fetchone()
                if row is None:
                    return "missing"
                if row["user_id"] != user_id:
                    return "forbidden"
                # Retry physical cleanup even for a previously retired ID.
                await AsyncPostgresSaver(connection).adelete_thread(conversation_id)
                await connection.execute(
                    "UPDATE chats SET deleted_at = COALESCE(deleted_at, now()), "
                    "chat_title = 'New Chat', assistant_id = NULL WHERE conversation_id = %s",
                    (conversation_id,),
                )
            return "deleted"

    @staticmethod
    def _get_session_factory() -> async_sessionmaker[AsyncSession]:
        """Return metadata sessions, raising if persistence is not initialized."""
        if PersistanceHelpers._session_factory is None:
            raise RuntimeError("PersistanceHelpers not initialized")
        return PersistanceHelpers._session_factory
