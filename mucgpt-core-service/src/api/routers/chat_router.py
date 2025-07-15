import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages.human import HumanMessage

from agent.tools.tools import ToolCollection
from api.api_models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    CountResult,
    CountTokenRequest,
)
from api.exception import llm_exception_handler
from config.settings import get_settings
from core.auth import authenticate_user
from core.logtools import getLogger
from core.token_counter import (
    TokenCounter,
    TokenCounterError,
    UnsupportedMessageTypeError,
    UnsupportedModelError,
)
from init_app import init_agent

logger = getLogger()
settings = get_settings()
agent_executor = init_agent(settings)
token_counter = TokenCounter(logger)  # Create an instance with the application logger
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
        # Use enabled_tools from request if provided, otherwise use all available tools
        enabled_tools = (
            request.enabled_tools
            if request.enabled_tools is not None
            else [tool["name"] for tool in ToolCollection.list_tool_metadata()]
        )
        if request.stream:
            gen = agent_executor.run_with_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                model=request.model,
                department=user_info.department,
                enabled_tools=enabled_tools,
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
    "/counttokens",
    summary="Count tokens in a text",
    description="This endpoint receives a text and a model and returns the number of tokens.",
    response_model=CountResult,
    responses={
        200: {"description": "Successful Response"},
        401: {"description": "Unauthorized"},
        422: {"description": "Validation Error"},
        500: {"description": "Internal Server Error"},
    },
)
async def counttokens(
    request: CountTokenRequest, user_info=Depends(authenticate_user)
) -> CountResult:
    """
    This endpoint receives a text and a model and returns the number of tokens.
    """
    global token_counter
    try:
        counted_tokens = token_counter.num_tokens_from_messages(
            [HumanMessage(content=request.text)], request.model
        )
        return CountResult(count=counted_tokens)
    except UnsupportedModelError as e:
        logger.warning(f"Unsupported model in token counting: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except UnsupportedMessageTypeError as e:
        logger.warning(f"Unsupported message type in token counting: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except TokenCounterError as e:
        logger.error(f"Token counting error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except NotImplementedError as e:
        logger.warning(f"Not implemented error in token counting: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error in token counting: {str(e)}")
        raise HTTPException(status_code=500, detail="Counttokens failed!")
