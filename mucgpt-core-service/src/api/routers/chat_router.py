from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages.human import HumanMessage

from api.api_models import ChatRequest, ChatResult, CountResult, CountTokenRequest
from core.auth import authenticate_user
from core.helper import format_as_ndjson, llm_exception_handler
from core.logtools import getLogger
from core.modelhelper import num_tokens_from_messages
from init_app import chat_service

logger = getLogger()
router = APIRouter()


@router.post(
    "/chat_stream",
    summary="Get a streaming chat response",
    description="This endpoint receives a chat history and returns a streaming response.",
    responses={
        200: {"description": "Successful Response"},
        500: {"description": "Internal Server Error"},
    },
)
async def chat_stream(
    request: ChatRequest, user_info=Depends(authenticate_user)
) -> StreamingResponse:
    """
    This endpoint receives a chat history and returns a streaming response.
    """
    try:
        response_generator = chat_service.run_with_streaming(
            history=request.history,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            system_message=request.system_message,
            model=request.model,
            department=user_info.department,
        )
        response = StreamingResponse(
            format_as_ndjson(r=response_generator, logger=logger)
        )
        response.timeout = None  # type: ignore
        return response
    except Exception as e:
        logger.exception("Exception in /chat stream")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


@router.post(
    "/chat",
    summary="Get a single chat response",
    description="This endpoint receives a chat history and returns a single response.",
    response_model=ChatResult,
    responses={
        200: {"description": "Successful Response"},
        500: {"description": "Internal Server Error"},
    },
)
async def chat(
    request: ChatRequest, user_info=Depends(authenticate_user)
) -> ChatResult:
    """
    This endpoint receives a chat history and returns a single response.
    """
    try:
        chatResult = chat_service.run_without_streaming(
            history=request.history,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            system_message=request.system_message,
            department=user_info.department,
            llm_name=request.model,
        )
        return chatResult
    except Exception as e:
        logger.exception("Exception in /chat")
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
        counted_tokens = num_tokens_from_messages(
            [HumanMessage(request.text)], request.model
        )
        return CountResult(count=counted_tokens)
    except NotImplementedError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail="Counttokens failed!")
