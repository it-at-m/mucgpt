"""CRUD endpoints for server-side chat persistence.

Conversations and their messages live in the backend database (see
``app/database``). All endpoints are owner-scoped via the authenticated user.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from langchain_core.runnables import RunnableConfig
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_models import (
    AppendMessageRequest,
    ChatCompletionMessage,
    ConversationDetail,
    ConversationStateResponse,
    ConversationSummary,
    CreateConversationRequest,
    UpdateConversationRequest,
)
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from database.conversation_repo import ConversationRepository
from database.models import Conversation
from database.session import get_db_session
from init_app import init_agent

logger = getLogger()
router = APIRouter(prefix="/v1/conversations")

# Map LangChain message types to OpenAI-style roles for serialization.
_ROLE_BY_TYPE = {"human": "user", "ai": "assistant", "system": "system"}


def _state_messages_to_api(messages: list) -> list[ChatCompletionMessage]:
    """Serialize LangChain graph-state messages to API messages.

    Only human/ai/system messages with string content are surfaced; tool
    messages and tool-call-only assistant turns are skipped.
    """
    result: list[ChatCompletionMessage] = []
    for message in messages:
        role = _ROLE_BY_TYPE.get(getattr(message, "type", None))
        content = getattr(message, "content", None)
        if role is None or not isinstance(content, str) or content == "":
            continue
        result.append(ChatCompletionMessage(role=role, content=content))
    return result


def _to_detail(conversation: Conversation) -> ConversationDetail:
    """Serialize an ORM conversation (with messages) to the API model."""
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        favorite=conversation.favorite,
        assistant_id=conversation.assistant_id,
        model=conversation.model,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            ChatCompletionMessage(role=m.role, content=m.content)
            for m in conversation.messages
        ],
    )


@router.post(
    "",
    response_model=ConversationDetail,
    summary="Create a conversation",
)
async def create_conversation(
    request: CreateConversationRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationDetail:
    repo = ConversationRepository(session)
    conversation = await repo.create(
        user_id=user_info.user_id,
        conversation_id=request.id,
        title=request.title,
        assistant_id=request.assistant_id,
        model=request.model,
        config=request.config,
        messages=[(m.role, m.content) for m in request.messages],
    )
    await session.commit()
    await session.refresh(conversation)
    return _to_detail(conversation)


@router.get(
    "",
    response_model=list[ConversationSummary],
    summary="List the current user's conversations",
)
async def list_conversations(
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ConversationSummary]:
    repo = ConversationRepository(session)
    conversations = await repo.list_for_user(user_info.user_id)
    return [ConversationSummary.model_validate(c) for c in conversations]


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
    summary="Get a conversation with its messages",
)
async def get_conversation(
    conversation_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationDetail:
    repo = ConversationRepository(session)
    conversation = await repo.get_for_user(conversation_id, user_info.user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _to_detail(conversation)


@router.patch(
    "/{conversation_id}",
    response_model=ConversationSummary,
    summary="Update conversation title/favorite",
)
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationSummary:
    repo = ConversationRepository(session)
    conversation = await repo.update_meta(
        conversation_id,
        user_info.user_id,
        title=request.title,
        favorite=request.favorite,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.commit()
    await session.refresh(conversation)
    return ConversationSummary.model_validate(conversation)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    repo = ConversationRepository(session)
    deleted = await repo.delete(conversation_id, user_info.user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{conversation_id}/messages",
    response_model=ConversationDetail,
    summary="Append a message to a conversation",
)
async def append_message(
    conversation_id: str,
    request: AppendMessageRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationDetail:
    repo = ConversationRepository(session)
    message = await repo.append_message(
        conversation_id,
        user_info.user_id,
        role=request.message.role,
        content=request.message.content,
    )
    if message is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.commit()
    # Re-fetch with messages to return the full, ordered detail.
    conversation = await repo.get_for_user(conversation_id, user_info.user_id)
    return _to_detail(conversation)


@router.get(
    "/{conversation_id}/state",
    response_model=ConversationStateResponse,
    summary="Get checkpointed agent state for a conversation",
)
async def get_conversation_state(
    conversation_id: str,
    user_info: AuthenticationResult = Depends(authenticate_user),
    session: AsyncSession = Depends(get_db_session),
) -> ConversationStateResponse:
    """Return the LangGraph checkpointed agent state for this conversation.

    The conversation id is used as the LangGraph ``thread_id``. Returns an empty
    state with ``has_checkpoint=false`` when no run has been checkpointed yet.
    """
    repo = ConversationRepository(session)
    conversation = await repo.get_for_user(conversation_id, user_info.user_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    ae = await init_agent(user_info=user_info)
    config = RunnableConfig(configurable={"thread_id": conversation_id})
    try:
        snapshot = await ae.agent.graph.aget_state(config)
    except Exception as exc:
        # No checkpointer configured, or thread not found -> empty state.
        logger.debug("Could not read agent state for %s: %s", conversation_id, exc)
        return ConversationStateResponse(
            conversation_id=conversation_id, has_checkpoint=False
        )

    values = getattr(snapshot, "values", None) or {}
    messages = values.get("messages", []) if isinstance(values, dict) else []
    has_checkpoint = bool(values)
    next_nodes = list(getattr(snapshot, "next", ()) or ())

    return ConversationStateResponse(
        conversation_id=conversation_id,
        has_checkpoint=has_checkpoint,
        messages=_state_messages_to_api(messages),
        next=next_nodes,
    )
