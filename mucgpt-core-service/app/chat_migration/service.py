"""Writes an imported browser chat into the checkpoint and the chats table."""

from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy import func, update

from chat_migration.models import ConversationImportRequest
from core.persistance_helpers import PersistanceHelpers
from database.database_models import Chat

_import_graph: CompiledStateGraph | None = None


class ImportConflictError(Exception):
    """ID belongs to someone else or was deleted, the chat stays local."""


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
    if await PersistanceHelpers.is_user_in_conversation(user_id, conversation_id):
        # already migrated or chatted in since persistence exists, server wins
        if await PersistanceHelpers.has_checkpoint(conversation_id):
            return "skipped"
    # claims a fresh id, rejects foreign or deleted ones
    elif not await PersistanceHelpers.verify_user_in_conversation(
        user_id, conversation_id, request.assistant_id
    ):
        raise ImportConflictError(conversation_id)

    messages: list[HumanMessage | AIMessage] = []
    for turn in request.turns:
        messages += [HumanMessage(content=turn.user), AIMessage(content=turn.assistant)]
    # as_node marks the run as finished, the next chat turn starts normally
    await _get_import_graph().aupdate_state(
        {"configurable": {"thread_id": conversation_id}},
        {"messages": messages},
        as_node="import",
    )

    # update chats table also
    async with PersistanceHelpers._get_session_factory().begin() as session:
        await session.execute(
            update(Chat)
            .where(Chat.conversation_id == conversation_id, Chat.user_id == user_id)
            .values(
                chat_title=request.title,
                updated_at=request.last_edited or func.now(),
                assistant_id=func.coalesce(Chat.assistant_id, request.assistant_id),
            )
        )
    return "imported"
