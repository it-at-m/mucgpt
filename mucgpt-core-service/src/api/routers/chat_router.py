from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages.human import HumanMessage
from src.core.token_counter import (
    TokenCounter,
    TokenCounterError,
    UnsupportedMessageTypeError,
    UnsupportedModelError,
)
from sse_starlette.sse import EventSourceResponse

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
from init_app import init_chat_service

logger = getLogger()
settings = get_settings()
chat_service = init_chat_service(settings.backend)
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
    try:
        if request.stream:
            gen = chat_service.run_with_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                model=request.model,
                department=user_info.department,
            )
            response = EventSourceResponse(gen)
            response.timeout = None  # type: ignore
            return response
        else:
            return chat_service.run_without_streaming(
                messages=request.messages,
                temperature=request.temperature,
                max_output_tokens=request.max_tokens,
                model=request.model,
                department=user_info.department,
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
    except Exception as e:
        logger.exception(f"Unexpected error in token counting: {str(e)}")
        raise HTTPException(status_code=500, detail="Counttokens failed!")
