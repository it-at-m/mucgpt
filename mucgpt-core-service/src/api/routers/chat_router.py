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
from core.logtools import getLogger
from init_app import init_agent

logger = getLogger()
settings = get_settings()
agent_executor = init_agent(settings)
router = APIRouter(prefix="/v1")


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
    request: ChatCompletionRequest, user_info=Depends(authenticate_user)
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming)
    """
    global agent_executor
    try:
        # Use enabled_tools from request if provided, otherwise use no tool
        enabled_tools = (
            request.enabled_tools if request.enabled_tools is not None else []
        )
        if request.stream:
            gen = agent_executor.run_with_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                model=request.model,
                department=user_info.department,
                enabled_tools=enabled_tools,
                assistant_id=request.assistant_id,
            )

            async def sse_generator():
                async for chunk in gen:
                    yield f"data: {json.dumps(chunk)}\n\n"

            return StreamingResponse(sse_generator(), media_type="text/event-stream")
        else:
            return agent_executor.run_without_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                model=request.model,
                department=user_info.department,
                enabled_tools=enabled_tools,
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
    global agent_executor
    try:
        logger.info("createAssistant: reading system prompt generator")
        with open("create_assistant/prompt_for_systemprompt.md", encoding="utf-8") as f:
            system_message = f.read()
        messages: List[ChatCompletionMessage] = [
            ChatCompletionMessage(role="system", content=system_message),
            ChatCompletionMessage(role="user", content="Funktion: " + request.input),
        ]
        logger.info("createAssistant: creating system prompt")
        system_prompt = agent_executor.run_without_streaming(
            messages=messages,
            temperature=1.0,
            max_output_tokens=request.max_tokens,
            model=request.model,
            department=user_info.department,
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
        description = agent_executor.run_without_streaming(
            messages=messages,
            temperature=1.0,
            max_output_tokens=request.max_tokens,
            model=request.model,
            department=user_info.department,
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
        title = agent_executor.run_without_streaming(
            messages=messages,
            temperature=1.0,
            max_output_tokens=request.max_tokens,
            model=request.model,
            department=user_info.department,
        )
        title = title.choices[0].message.content
        logger.info("createAssistant: returning finished")
        return {
            "title": title,
            "description": description,
            "system_prompt": system_prompt,
        }
    except Exception as e:
        logger.exception("Exception in /create_assistant")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)
