import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.api_models import (
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    CreateAssistantRequest,
    CreateAssistantResult,
)
from api.exception import llm_exception_handler
from config.settings import get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
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
        model_config = next(
            (m for m in settings.MODELS if m.llm_name == request.model), None
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
async def chat_completions(
    request: ChatCompletionRequest,
    user_info: AuthenticationResult = Depends(authenticate_user),
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming)
    """
    ae = await init_agent(user_info=user_info)
    try:
        # Convert creativity to temperature
        temperature = get_temperature_from_request(request)

        # Use enabled_tools from request if provided, otherwise use no tool
        enabled_tools = request.enabled_tools or []
        if request.stream:
            gen = ae.run_with_streaming(
                messages=request.messages,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
            )

            async def sse_generator():
                async for chunk in gen:
                    yield f"data: {json.dumps(chunk)}\n\n"

            return StreamingResponse(sse_generator(), media_type="text/event-stream")
        else:
            return ae.run_without_streaming(
                messages=request.messages,
                temperature=temperature,
                model=request.model,
                user_info=user_info,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
            )
    except Exception as e:
        logger.exception("Exception in /chat/completions")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


@router.post(
    "/generate/assistant",
)
async def create_assistant(
    request: CreateAssistantRequest, user_info=Depends(authenticate_user)
) -> CreateAssistantResult:
    ae = await init_agent(user_info=user_info)
    try:
        logger.info("createAssistant: reading system prompt generator")
        with open("create_assistant/prompt_for_systemprompt.md", encoding="utf-8") as f:
            system_message = f.read()
        messages: List[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(role="user", content="Funktion: " + request.input),
        ]
        logger.info("createAssistant: creating system prompt")
        system_prompt = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        system_prompt = system_prompt.choices[0].message.content
        logger.info(system_prompt)
        logger.info("createAssistant: creating description prompt")
        with open("create_assistant/prompt_for_description.md", encoding="utf-8") as f:
            system_message = f.read()
        messages: List[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user", content="Systempromt: ```" + system_prompt + "```"
            ),
        ]
        logger.info("createAssistant: creating description")
        description = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        description = description.choices[0].message.content
        logger.info("createAssistant: creating title prompt")
        with open("create_assistant/prompt_for_title.md", encoding="utf-8") as f:
            system_message = f.read()
        logger.info("createAssistant: creating title")
        messages: List[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(
                role="user",
                content="Systempromt: ```"
                + system_prompt
                + "```\nBeschreibung: ```"
                + description
                + "```",
            ),
        ]
        title = ae.run_without_streaming(
            messages=messages,
            temperature=1.0,
            model=request.model,
            user_info=user_info,
        )
        title = title.choices[0].message.content
        logger.info("createAssistant: returning finished")
        return CreateAssistantResult(
            title=title,
            description=description,
            system_prompt=system_prompt,
        )
    except Exception as e:
        logger.exception("Exception in /create_assistant")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
