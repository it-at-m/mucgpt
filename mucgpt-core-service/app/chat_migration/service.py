"""Writes an imported browser chat into the checkpoint and the chats table."""

from datetime import UTC, datetime
from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy import delete, func, update

from chat_migration.models import ConversationImportRequest
from core.persistance_helpers import PersistanceHelpers
from database.database_models import Chat

_import_graph: CompiledStateGraph | None = None


class ImportConflictError(Exception):
    """ID belongs to someone else or was deleted, the chat stays local."""


def _activity_time(last_edited: datetime | None) -> datetime:
    """Browser timestamp for the history order, never in the future."""
    now = datetime.now(UTC)
    if last_edited is None:
        return now
    if last_edited.tzinfo is None:
        last_edited = last_edited.replace(tzinfo=UTC)
    # a client clock running ahead would pin the chat on top forever
    return min(last_edited, now)


def _noop(_state: MessagesState) -> dict[str, Any]:
    # never runs, aupdate_state only needs a node to attribute the write to
    return {}


def _get_import_graph() -> CompiledStateGraph:
    """use a small simple langgraph graph and the checkpointer to persist existing chats efficiently"""
    global _import_graph
    checkpointer = PersistanceHelpers.get_checkpointer()
    # rebuild if the checkpointer was swapped (restart, tests)
    if _import_graph is None or _import_graph.checkpointer is not checkpointer:
        # ty can't match TypedDicts to langgraph's StateLike (see simplify_agent.py)
        graph = StateGraph(MessagesState)  # ty: ignore[invalid-argument-type]
        graph.add_node("import", _noop)  # ty: ignore[invalid-argument-type]
        graph.add_edge(START, "import")
        _import_graph = graph.compile(checkpointer=checkpointer)
    return _import_graph


async def import_chat(
    request: ConversationImportRequest, user_id: str
) -> Literal["imported", "skipped"]:
    """Store a browser chat once; repeating it is harmless."""
    conversation_id = request.conversation_id
    claimed = False
    if await PersistanceHelpers.is_user_in_conversation(user_id, conversation_id):
        # already migrated or chatted in since persistence exists, server wins
        if await PersistanceHelpers.has_checkpoint(conversation_id):
            return "skipped"
    # claims a fresh id, rejects foreign or deleted ones
    elif await PersistanceHelpers.verify_user_in_conversation(
        user_id, conversation_id, request.assistant_id
    ):
        claimed = True
    else:
        raise ImportConflictError(conversation_id)

    messages: list[HumanMessage | AIMessage] = []
    for turn in request.turns:
        messages += [HumanMessage(content=turn.user), AIMessage(content=turn.assistant)]
    live_row = (
        Chat.conversation_id == conversation_id,
        Chat.user_id == user_id,
        Chat.deleted_at.is_(None),  # never touch a chat deleted meanwhile
    )
    try:
        # metadata first: the checkpoint marks the import as done, a retry skips it
        async with PersistanceHelpers._get_session_factory().begin() as session:
            await session.execute(
                update(Chat)
                .where(*live_row)
                .values(
                    chat_title=request.title,
                    updated_at=_activity_time(request.last_edited), # ensure chat ordering is preserved if possible!
                    assistant_id=func.coalesce(Chat.assistant_id, request.assistant_id),
                )
            )
        # as_node marks the run as finished, the next chat turn starts normally
        await _get_import_graph().aupdate_state(
            {"configurable": {"thread_id": conversation_id}},
            {"messages": messages},
            as_node="import",
        )
    except Exception:
        if claimed:
            # drop the row we just claimed, otherwise the history listing marks the
            # chat as persisted and the frontend never retries the import.
            # hard delete, a retired id could not be claimed again
            async with PersistanceHelpers._get_session_factory().begin() as session:
                await session.execute(delete(Chat).where(*live_row))
        raise
    return "imported"
