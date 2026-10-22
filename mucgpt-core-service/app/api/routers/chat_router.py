import json
from collections.abc import AsyncGenerator
from typing import Annotated

from ag_ui.encoder import EventEncoder
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from api.api_models import (
    CanvasResponse,
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ConversationMessage,
    ConversationMetadata,
)
from api.exception import llm_exception_handler
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.persistance_helpers import PersistanceHelpers
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
        selected_model_name = request.model or settings.MODELS[0].llm_name
        model_config = next(
            (m for m in settings.MODELS if m.llm_name == selected_model_name), None
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

    # The canvas is saved implicitly with every persisted turn.
    if request.canvas is not None:
        await PersistanceHelpers.upsert_canvas(
            request.conversation_id, request.canvas.content
        )

    if await PersistanceHelpers.has_checkpoint(request.conversation_id):
        return [request.messages[-1]]
    return request.messages


@router.post(
    "/chat/completions",
    summary="Create chat completion",
    description="OpenAI-compatible endpoint for chat completions",
    response_model=ChatCompletionResponse,
    responses={
        200: {"description": "Successful Response"},
        400: {"description": "Bad Request"},
        403: {"description": "Forbidden"},
        500: {"description": "Internal Server Error"},
    },
)
async def chat_endpoint(
    request: ChatCompletionRequest,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming)
    """
    if not request.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    if request.messages[-1].role != "user":
        raise HTTPException(
            status_code=400, detail="last message must have role 'user'"
        )

    try:
        messages_for_agent = await get_messages_for_agent(request, user_info.user_id)

        agent = await init_agent(
            user_info=user_info, model_name=request.model, persist=request.persist
        )
        temperature = get_temperature_from_request(request)
        enabled_tools = request.enabled_tools or []
        data_sources = (
            [source.model_dump() for source in request.data_sources]
            if request.data_sources
            else None
        )
        canvas = request.canvas

        if request.stream:
            gen = agent.run_with_streaming(
                messages=messages_for_agent,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
                data_sources=data_sources,
                canvas=canvas,
                conversation_id=request.conversation_id,
                reasoning_effort=request.reasoning_effort,
            )

            async def sse_generator() -> AsyncGenerator[str]:
                async for chunk in gen:
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(sse_generator(), media_type="text/event-stream")

        response = await agent.run_without_streaming(
            messages=messages_for_agent,
            temperature=temperature,
            model=request.model,
            user_info=user_info,
            enabled_tools=enabled_tools,
            assistant_id=request.assistant_id,
            data_sources=data_sources,
            canvas=canvas,
            conversation_id=request.conversation_id,
            reasoning_effort=request.reasoning_effort,
        )

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Exception in /chat/completions")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg) from e


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

    messages = await PersistanceHelpers.get_conversation_messages(conversation_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return messages


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete conversation",
    status_code=204,
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal Server Error"},
    },
)
async def delete_conversation(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> None:
    """Delete the conversation: its ownership row, its canvas row and all
    LangGraph checkpoint state."""
    await _authorize_conversation_access(conversation_id, user_info.user_id)

    checkpointer = PersistanceHelpers.get_checkpointer_if_ready()
    if checkpointer is None:
        raise HTTPException(status_code=500, detail="Persistence not initialized")

    # Delete the checkpoint state before the ownership row. If the row went first
    # and this failed, the orphaned state would be handed to whoever next sends
    # this conversation_id. Keeping the row on failure lets the owner retry.
    try:
        await checkpointer.adelete_thread(conversation_id)
    except Exception as e:
        logger.exception(
            "Failed to delete checkpoint state for conversation %s", conversation_id
        )
        raise HTTPException(
            status_code=500, detail="Failed to delete conversation"
        ) from e

    # Ownership row and canvas row are deleted in one transaction: a failed
    # canvas delete rolls the ownership row back too, so no personal data is
    # orphaned and the owner can retry.
    try:
        deleted = await PersistanceHelpers.delete_conversation_with_canvas(
            conversation_id, user_info.user_id
        )
    except Exception as e:
        logger.exception("Failed to delete conversation %s", conversation_id)
        raise HTTPException(
            status_code=500, detail="Failed to delete conversation"
        ) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")


async def _authorize_conversation_access(conversation_id: str, user_id: str) -> None:
    """404 for missing and foreign conversations alike, so responses do not
    reveal which conversation ids exist."""
    if not await PersistanceHelpers.is_user_in_conversation(user_id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get(
    "/conversations/{conversation_id}/canvas",
    summary="Get conversation canvas",
    response_model=CanvasResponse,
    responses={404: {"description": "Not found"}},
)
async def get_conversation_canvas(
    conversation_id: str,
    user_info: Annotated[AuthenticationResult, Depends(authenticate_user)],
) -> CanvasResponse:
    """Return the canvas document stored for the conversation."""
    await _authorize_conversation_access(conversation_id, user_info.user_id)

    canvas = await PersistanceHelpers.get_canvas(conversation_id)
    if canvas is None:
        raise HTTPException(status_code=404, detail="Canvas not found")
    return CanvasResponse(content=canvas.content, updated_at=canvas.updated_at)


@router.get(
    "/conversations/{conversation_id}/canvas/revisions",
    summary="Get conversation canvas revisions",
    responses={404: {"description": "Not found"}},
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

    await PersistanceHelpers.upsert_canvas_revisions(conversation_id, revisions)
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
        async for event in events:
            yield encoder.encode(event)

    return StreamingResponse(event_generator(), media_type=encoder.get_content_type())
