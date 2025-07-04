import io
import time

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.params import Depends
from fastapi.responses import (
    RedirectResponse,
    StreamingResponse,
)
from langchain_core.messages.human import HumanMessage
from pydantic_core import from_json

from config.settings import ConfigResponse, ModelsDTO
from core.auth import authenticate_user
from core.auth_models import AuthError
from core.helper import format_as_ndjson, llm_exception_handler
from core.logtools import getLogger
from core.modelhelper import num_tokens_from_messages
from core.types.BrainstormRequest import BrainstormRequest
from core.types.BrainstormResult import BrainstormResult
from core.types.ChatRequest import ChatRequest
from core.types.ChatResult import ChatResult
from core.types.countresult import CountResult
from core.types.CountTokenRequest import CountTokenRequest
from core.types.SimplyRequest import SimplyRequest
from core.types.SummarizeResult import SummarizeResult
from core.types.SumRequest import SumRequest
from init_app import initApp

logger = getLogger()
# serves static files and the api
backend = FastAPI(title="MUCGPT")
# serves the api
api_app = FastAPI(title="MUCGPT-API")
backend.mount("/api/", api_app)

api_app.add_middleware(CorrelationIdMiddleware)

# init the app
(
    chat_service,
    brainstorm_service,
    summarize_service,
    simply_service,
    settings,
    departments,
) = initApp()


@api_app.exception_handler(AuthError)
async def handleAuthError(request, exc: AuthError):
    # return error.error, error.status_code
    return RedirectResponse(
        url=settings.backend.unauthorized_user_redirect_url, status_code=302
    )


@api_app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    # add trace information
    if "x-request-id" in response.headers:
        correlation_id.set(response.headers["x-request-id"])
    logger.info(
        "Request %s took %.3f seconds", request.url.path, time.time() - start_time
    )
    # remove trace information
    correlation_id.set(None)
    return response


@api_app.post("/sum")
async def sum(
    body: str = Form(...), file: UploadFile = None, user_info=Depends(authenticate_user)
) -> SummarizeResult:
    sumRequest = SumRequest.model_validate(from_json(body))
    text = sumRequest.text if file is None else None
    if file is not None:
        file_content = io.BytesIO(await file.read())
    else:
        file_content = None
    try:
        splits = summarize_service.split(
            detaillevel=sumRequest.detaillevel, file=file_content, text=text
        )
        r = await summarize_service.summarize(
            splits=splits,
            department=user_info.department,
            language=sumRequest.language,
            llm_name=sumRequest.model,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /sum")
        logger.exception(str(e))
        raise HTTPException(
            status_code=500, detail="Exception in summarize: something bad happened"
        )


@api_app.post("/brainstorm")
async def brainstorm(
    request: BrainstormRequest, user_info=Depends(authenticate_user)
) -> BrainstormResult:
    try:
        r = await brainstorm_service.brainstorm(
            topic=request.topic,
            language=request.language,
            department=user_info.department,
            llm_name=request.model,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /brainstorm")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


@api_app.post("/simply")
async def simply(
    request: SimplyRequest, user_info=Depends(authenticate_user)
) -> ChatResult:
    try:
        r = simply_service.simply(
            message=request.topic,
            department=user_info.department,
            llm_name=request.model,
            temperature=request.temperature,
        )
        return r
    except Exception as e:
        logger.exception("Exception in /simply")
        msg = llm_exception_handler(ex=e, logger=logger)
        raise HTTPException(status_code=500, detail=msg)


@api_app.post("/chat_stream")
async def chat_stream(
    request: ChatRequest, user_info=Depends(authenticate_user)
) -> StreamingResponse:
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


@api_app.post("/chat")
async def chat(
    request: ChatRequest, user_info=Depends(authenticate_user)
) -> ChatResult:
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


@api_app.get("/config")
async def getConfig(user_info=Depends(authenticate_user)) -> ConfigResponse:
    response = ConfigResponse(
        frontend=settings.frontend,
        version=settings.version,
        commit=settings.commit,
    )

    models = settings.backend.models
    for model in models:
        dto = ModelsDTO(
            llm_name=model.llm_name,
            max_output_tokens=model.max_output_tokens,
            max_input_tokens=model.max_input_tokens,
            description=model.description,
        )
        response.models.append(dto)
    return response


@api_app.post("/counttokens")
async def counttokens(
    request: CountTokenRequest, user_info=Depends(authenticate_user)
) -> CountResult:
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


@api_app.get("/health")
def health_check() -> str:
    return "OK"
