from collections.abc import AsyncGenerator
from typing import Annotated

from ag_ui.encoder import EventEncoder
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from api.api_models import (
    CanvasResponse,
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatTitleResult,
    ConversationAssistantRebindRequest,
    ConversationMessage,
    ConversationMetadata,
    ConversationRenameRequest,
)
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.persistance_helpers import PersistanceHelpers
from core.stream_cleanup import close_stream
from database.fenced_checkpointer import ConversationDeletedError
from init_app import init_agent

logger = getLogger()
router = APIRouter(prefix="/v1")

CANVAS_REVISIONS_MAX_BYTES = 512 * 1024


def get_temperature_from_request(request: ChatCompletionRequest) -> float:
    """Convert creativity to temperature based on the selected model.

    Args:
        request: The chat completion request

    Returns:
        The temperature value to use for the LLM call
    """
    # If creativity is provided, convert it to temperature based on the model
    if request.creativity:
        settings = get_settings()
        # Find the model configuration
        selected_model_name = request.model or settings.models[0].id
        model_config = next(
            (m for m in settings.models if m.id == selected_model_name), None
        )

        if model_config:
            try:
                return model_config.get_temperature_for_creativity(request.creativity)
            except ValueError:
                logger.warning(
                    f"Invalid creativity level '{request.creativity}', using default 'medium'"
                )
                return model_config.get_temperature_for_creativity("medium")
        else:
            # Model not found, use default mapping
            logger.warning(
                f"Model '{request.model}' not found in configuration, using default temperature mapping"
            )
            default_temps = {
                "low": 0.0,
                "medium": 0.5,
                "high": 1.0,
            }
            return default_temps.get(request.creativity, 0.5)

    # Fall back to temperature if provided (backward compatibility)
    if request.temperature is not None:
        return request.temperature

    # Default temperature
    return 0.5


async def get_messages_for_agent(
    request: ChatCompletionRequest, user_id: str
) -> list[ChatCompletionMessage]:
    """Authorize the conversation and pick the messages the agent receives.

    A stateless request (``persist=False``) runs on the full client history. A
    persisted conversation is seeded with the full history on its first turn so
    the system prompt and existing browser-held turns are retained; once state
    exists, only the newest user message is appended to avoid duplicating it.
    Retired/foreign IDs are rejected. This prepares new turns, not replace/resume
    operations; local history edits do not rewind an existing checkpoint.
    """
    if not request.persist:
        return request.messages

    # Verify the conversation belongs to this user (row is created on first use).
    authorized = await PersistanceHelpers.verify_user_in_conversation(
        user_id, request.conversation_id, request.assistant_id
    )
    if not authorized:
        raise HTTPException(
            status_code=403,
            detail=f"User {user_id} is not authorized to access conversation {request.conversation_id}",
        )

    # The canvas is saved implicitly with every persisted turn. A truncated
    # canvas (editor document beyond the persistence limit) carries only the
    # beginning of the document: persisting it would silently destroy the tail,
    # so the stored copy is left untouched.
    if request.canvas is not None and not request.canvas.truncated:
        await PersistanceHelpers.upsert_canvas(
            request.conversation_id, request.canvas.content, user_id
        )

    if await PersistanceHelpers.has_checkpoint(request.conversation_id):
        return [request.messages[-1]]
    return request.messages


@router.get(
    "/conversations",
    summary="List the caller's conversations",
    response_model=list[ConversationMetadata],
)
async def list_conversations(
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> list[ConversationMetadata]:
    """Return the authenticated user's conversations as metadata (no messages),
    most recently active first."""
    rows = await PersistanceHelpers.get_conversations_for_user(user_info.user_id)
    return [ConversationMetadata(**row) for row in rows]


@router.get(
    "/conversations/{conversation_id}/messages",
    summary="Get conversation messages",
    response_model=list[ConversationMessage],
    response_model_exclude_defaults=True,
    responses={403: {"description": "Forbidden"}, 404: {"description": "Not found"}},
)
async def get_conversation_messages(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> list[ConversationMessage]:
    """Return the user/assistant chain from the conversation's latest checkpoint."""
    if not await PersistanceHelpers.is_user_in_conversation(
        user_info.user_id, conversation_id
    ):
        raise HTTPException(status_code=403, detail="Conversation access denied")

    try:
        messages = await PersistanceHelpers.get_conversation_messages(conversation_id)
    except ConversationDeletedError as exc:
        raise HTTPException(status_code=404, detail="Conversation not found") from exc
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return messages


@router.patch(
    "/conversations/{conversation_id}",
    summary="Rename conversation",
    responses={403: {"description": "Forbidden"}, 404: {"description": "Not found"}},
)
async def rename_conversation(
    conversation_id: str,
    request: ConversationRenameRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> ChatTitleResult:
    """Persist a manual rename without creating or reviving conversations."""
    renamed = await PersistanceHelpers.rename_conversation(
        conversation_id, user_info.user_id, request.title
    )
    if not renamed:
        if await PersistanceHelpers.conversation_exists(conversation_id):
            raise HTTPException(status_code=403, detail="Conversation access denied")
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ChatTitleResult(title=request.title)


@router.patch(
    "/conversations/{conversation_id}/assistant",
    summary="Re-bind conversation to an assistant",
    status_code=204,
    responses={403: {"description": "Forbidden"}, 404: {"description": "Not found"}},
)
async def rebind_conversation_assistant(
    conversation_id: str,
    request: ConversationAssistantRebindRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> None:
    """Point an existing conversation's assistant association at another assistant.

    Used when chats move to a different assistant; never creates or revives
    conversations.
    """
    rebound = await PersistanceHelpers.set_conversation_assistant(
        conversation_id, user_info.user_id, request.assistant_id
    )
    if not rebound:
        if await PersistanceHelpers.conversation_exists(conversation_id):
            raise HTTPException(status_code=403, detail="Conversation access denied")
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete conversation",
    status_code=204,
    responses={
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        500: {"description": "Internal Server Error"},
    },
)
async def delete_conversation(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> None:
    """Return 204 after atomic erasure/retirement, including an owner's retry.

    Unknown IDs return 404, other owners receive 403, and cleanup failures return
    500 with the protected ownership row retained for retry. The conversation's
    canvas row (content plus revision rings) is cascaded inside the same
    transaction.
    """
    try:
        result = await PersistanceHelpers.erase_conversation(
            conversation_id, user_info.user_id
        )
    except Exception as e:
        logger.exception(
            "Failed to delete checkpoint state for conversation %s", conversation_id
        )
        raise HTTPException(
            status_code=500, detail="Failed to delete conversation"
        ) from e

    if result == "missing":
        raise HTTPException(status_code=404, detail="Conversation not found")
    if result == "forbidden":
        raise HTTPException(status_code=403, detail="Conversation access denied")


async def _authorize_conversation_access(conversation_id: str, user_id: str) -> None:
    """404 for missing conversations, 403 for foreign ones."""
    if not await PersistanceHelpers.conversation_exists(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await PersistanceHelpers.is_user_in_conversation(user_id, conversation_id):
        raise HTTPException(status_code=403, detail="Conversation access denied")


@router.get(
    "/conversations/{conversation_id}/canvas",
    summary="Get conversation canvas",
    response_model=CanvasResponse,
    responses={403: {"description": "Forbidden"}, 404: {"description": "Not found"}},
)
async def get_conversation_canvas(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> CanvasResponse:
    """Return the canvas document stored for the conversation.

    An empty content means an empty canvas: the row can exist with empty
    content because revisions are stored before any document, and an open
    empty editor is a legitimate persisted state.
    """
    await _authorize_conversation_access(conversation_id, user_info.user_id)

    canvas = await PersistanceHelpers.get_canvas(conversation_id)
    if canvas is None:
        raise HTTPException(status_code=404, detail="Canvas not found")
    return CanvasResponse(content=canvas.content, updated_at=canvas.updated_at)


@router.get(
    "/conversations/{conversation_id}/canvas/revisions",
    summary="Get conversation canvas revisions",
    responses={403: {"description": "Forbidden"}, 404: {"description": "Not found"}},
)
async def get_conversation_canvas_revisions(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> dict | None:
    """Return the client-owned revision rings for the conversation's canvas."""
    await _authorize_conversation_access(conversation_id, user_info.user_id)

    revisions = await PersistanceHelpers.get_canvas_revisions(conversation_id)
    if revisions is None:
        raise HTTPException(status_code=404, detail="Canvas revisions not found")
    return revisions


@router.put(
    "/conversations/{conversation_id}/canvas/revisions",
    summary="Replace conversation canvas revisions",
    status_code=204,
    responses={
        403: {"description": "Forbidden"},
        404: {"description": "Not found"},
        413: {"description": "Revisions payload too large"},
    },
)
async def put_conversation_canvas_revisions(
    conversation_id: str,
    request: Request,
    revisions: dict,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> Response:
    """Wholesale-overwrite the client-owned revision rings (max 512 KB)."""
    await _authorize_conversation_access(conversation_id, user_info.user_id)

    if len(await request.body()) > CANVAS_REVISIONS_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Canvas revisions exceed the maximum payload size of 512 KB",
        )

    await PersistanceHelpers.upsert_canvas_revisions(
        conversation_id, revisions, user_info.user_id
    )
    return Response(status_code=204)


@router.post(
    "/chat/v2/completions",
    summary="Create chat completion",
    description="OpenAI-compatible endpoint for chat completions",
    response_class=StreamingResponse,
    responses={
        200: {"description": "Successful Response"},
        400: {"description": "Bad Request"},
        403: {"description": "Forbidden"},
        500: {"description": "Internal Server Error"},
    },
)
async def ag_ui_chat_endpoint(
    chat_request: ChatCompletionRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
    request: Request,
) -> StreamingResponse:
    """Validate/authorize a turn and stream AG-UI events, regardless of the stream flag.

    Persistence follows the same append-only preparation as v1. Closing the
    response iterator also closes the executor during errors or disconnects.
    """
    if not chat_request.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    if not chat_request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    if not chat_request.messages[-1].role == "user":
        raise HTTPException(
            status_code=400, detail="Last message must be from the user (role='user')"
        )

    try:
        ModelRegistry.get_model(chat_request.model)
    except ModelsConfigurationException as exc:
        detail = str(exc)
        status_code = 400
        if "not initialized" in detail.lower():
            status_code = 500
        raise HTTPException(status_code=status_code, detail=detail) from exc

    messages_for_agent = await get_messages_for_agent(chat_request, user_info.user_id)

    encoder = EventEncoder(accept=request.headers.get("accept"))
    agent = await init_agent(
        user_info=user_info,
        model_name=chat_request.model,
        persist=chat_request.persist,
    )
    events = agent.run_agui_with_streaming(
        messages=messages_for_agent,
        temperature=get_temperature_from_request(chat_request),
        model=chat_request.model,
        user_info=user_info,
        conversation_id=chat_request.conversation_id,
        enabled_tools=chat_request.enabled_tools or [],
        assistant_id=chat_request.assistant_id,
        data_sources=(
            [source.model_dump() for source in chat_request.data_sources]
            if chat_request.data_sources
            else None
        ),
        canvas=chat_request.canvas,
        reasoning_effort=chat_request.reasoning_effort,
    )

    async def event_generator() -> AsyncGenerator[str]:
        """Encode AG-UI events and close their source on completion or cancellation."""
        try:
            async for event in events:
                yield encoder.encode(event)
        finally:
            await close_stream(events)

    return StreamingResponse(event_generator(), media_type=encoder.get_content_type())
