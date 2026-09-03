import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.api_models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from api.exception import llm_exception_handler
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.persistance_helpers import PersistanceHelpers
from init_app import init_agent

logger = getLogger()
router = APIRouter(prefix="/v1")


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
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming)
    """
    if not request.conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    try:
        # Verify the conversation belongs to this user (row is created on first use).
        authorized = await PersistanceHelpers.verify_user_in_conversation(
            user_info.user_id, request.conversation_id
        )
        if not authorized:
            raise HTTPException(
                status_code=403,
                detail=f"User {user_info.user_id} is not authorized to access conversation {request.conversation_id}",
            )

        # Persist the newest incoming user message in the frontend-style history.
        # NOTE: creates a user row for every request.
        # A retry after a dropped completed response stores the same user message again.
        # The existing checkpoint then causes the agent to append the same latest message as a new turn.
        # worth addressing in future!
        await PersistanceHelpers.insert_message(
            user_info.user_id,
            request.conversation_id,
            request.messages[-1],
            message_type="user",
        )

        # Seed a new checkpoint with the complete client history so the system
        # prompt and existing browser-held turns are retained. Once state exists,
        # only append the newest user message to avoid duplicating the history.
        messages_for_agent = (
            [request.messages[-1]]
            if await PersistanceHelpers.has_checkpoint(request.conversation_id)
            else request.messages
        )

        agent = await init_agent(user_info=user_info, model_name=request.model)
        temperature = get_temperature_from_request(request)
        enabled_tools = request.enabled_tools or []
        data_sources = (
            [source.model_dump() for source in request.data_sources]
            if request.data_sources
            else None
        )

        if request.stream:
            gen = agent.run_with_streaming(
                messages=messages_for_agent,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
                data_sources=data_sources,
                conversation_id=request.conversation_id,
            )

            async def sse_generator() -> AsyncGenerator[str]:
                parts: list[str] = []
                completed = False
                async for chunk in gen:
                    choice = (chunk.get("choices") or [{}])[0]
                    content = choice.get("delta", {}).get("content")
                    if content:
                        parts.append(content)
                    if choice.get("finish_reason") == "stop":
                        completed = True
                    yield f"data: {json.dumps(chunk)}\n\n"

                # Persist the assistant reply only when the stream finished cleanly
                # (not on client disconnect or an error chunk).
                if completed and parts:
                    await PersistanceHelpers.insert_message(
                        user_info.user_id,
                        request.conversation_id,
                        {"role": "assistant", "content": "".join(parts)},
                        message_type="assistant",
                    )
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
            conversation_id=request.conversation_id,
        )

        choice = response.choices[0] if response and response.choices else None
        if choice and choice.finish_reason == "stop" and choice.message.content:
            await PersistanceHelpers.insert_message(
                user_info.user_id,
                request.conversation_id,
                choice.message,
                message_type="assistant",
            )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Exception in /chat/completions")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg) from e
