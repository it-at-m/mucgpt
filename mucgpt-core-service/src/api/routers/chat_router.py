import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from agent.agent_executor import MUCGPTAgentExecutor
from api.api_models import (
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    CreateAssistantRequest,
    CreateAssistantResult,
)
from api.exception import llm_exception_handler
from config.settings import get_langfuse_settings, get_settings
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from core.logtools import getLogger
from init_app import init_agent

logger = getLogger()
agent_executors : dict[str, MUCGPTAgentExecutor] = {}
router = APIRouter(prefix="/v1")


async def get_agent_executor(user_info: AuthenticationResult) -> MUCGPTAgentExecutor:
    # FIXME global cache for multi instance?
    global agent_executors
    uid = user_info.user_id
    if agent_executors.get(uid) is None:
        settings = get_settings()
        langfuse_settings = get_langfuse_settings()
        agent_executor = await init_agent(cfg=settings, langfuse_cfg=langfuse_settings, user_info=user_info)
        agent_executors[uid] = agent_executor
    return agent_executors[uid]

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
    request: ChatCompletionRequest, user_info: AuthenticationResult=Depends(authenticate_user)
) -> StreamingResponse | ChatCompletionResponse:
    """
    OpenAI-compatible chat completion endpoint (streaming or non-streaming)
    """
    ae = await get_agent_executor(user_info)
    try:
        # Use enabled_tools from request if provided, otherwise use no tool
        enabled_tools = (
            request.enabled_tools if request.enabled_tools is not None else []
        )
        if request.stream:
            gen = ae.run_with_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
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
    ae = await get_agent_executor(user_info)
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
        description = ae.run_without_streaming(
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
        title = ae.run_without_streaming(
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
