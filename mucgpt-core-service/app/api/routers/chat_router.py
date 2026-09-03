import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.api_models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from api.exception import llm_exception_handler
from config.model_provider import ModelRegistry, ModelsConfigurationException
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from core.persistance_tools import PersistanceTools
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
    # 1. verify user and chat 
    # SELECT user_id FROM chats WHERE chat_id/conversation_id=request.conversation_id 
    verify_user = await PersistanceTools.verify_user_in_conversation(user_info.user_id, request.conversation_id)
    if not verify_user:
        raise HTTPException(
            status_code=403,
            detail=f"User {user_info.user_id} is not authorized to access conversation {request.conversation_id}",
        )

    # 2. insert user message into messages table of user in postgres
    await PersistanceTools.insert_message(
        user_info.user_id, 
        request.conversation_id, 
        {"role": "user", "content": request.messages[-1].content if request.messages else ""},
        message_type="user",
        ) # for now whole history is sent but we need to user message

    # 3. initialize and invoke agent
    agent = await init_agent(user_info=user_info, model_name=request.model)

    assistant_msg: StreamingResponse | ChatCompletionResponse
    if request.stream:
        gen = agent.run_with_streaming(
            messages=[request.messages[-1]],
            temperature=get_temperature_from_request(request),
            model=request.model,
            user_info=user_info,
            enabled_tools=request.enabled_tools or [],
            assistant_id=request.assistant_id,
            data_sources=[source.model_dump() for source in request.data_sources]
            if request.data_sources else None,
            conversation_id=request.conversation_id,
        )

        async def sse_generator():
            chunks: list[str] = []
            try:
                async for chunk in gen:
                    # adjust this extraction to match your chunk shape
                    print(f"Received chunk: {chunk}")  # Debugging
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        chunks.append(content)

                    yield f"data: {json.dumps(chunk)}\n\n"

                yield "data: [DONE]\n\n"
            finally:
                # runs when the stream completes OR the client disconnects
                assistant_text = "".join(chunks)
                if assistant_text:
                    await PersistanceTools.insert_message(
                        user_info.user_id,
                        request.conversation_id,
                        {"role": "assistant", "content": assistant_text},
                        message_type="assistant",
                    )

        return StreamingResponse(sse_generator(), media_type="text/event-stream")
    else: 
        assistant_msg = await agent.run_without_streaming(
            messages=[request.messages[-1]],
            temperature=get_temperature_from_request(request),
            model=request.model,
            user_info=user_info,
            enabled_tools=request.enabled_tools or [],
            assistant_id=request.assistant_id,
            data_sources=[source.model_dump() for source in request.data_sources]
            if request.data_sources
            else None,
            conversation_id=request.conversation_id,
        )
        if assistant_msg:
            await PersistanceTools.insert_message(
                user_info.user_id,
                request.conversation_id,
                {"role": "assistant", "content": assistant_msg},
                message_type="assistant",
            )
        return assistant_msg
