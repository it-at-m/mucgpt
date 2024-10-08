import io
import logging
import os
from typing import List, cast

from fastapi import FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import (
    FileResponse,
    RedirectResponse,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from langchain_core.messages.human import HumanMessage
from pydantic_core import from_json

from core.authentification import AuthentificationHelper, AuthError
from core.helper import format_as_ndjson
from core.modelhelper import num_tokens_from_messages
from core.types.AppConfig import AppConfig
from core.types.BrainstormRequest import BrainstormRequest
from core.types.BrainstormResult import BrainstormResult
from core.types.ChatRequest import ChatRequest
from core.types.ChatResult import ChatResult
from core.types.Config import ConfigResponse, ModelsConfig, ModelsDTO
from core.types.countresult import CountResult
from core.types.CountTokenRequest import CountTokenRequest
from core.types.SimplyRequest import SimplyRequest
from core.types.StatisticsResponse import StatisticsResponse
from core.types.SummarizeResult import SummarizeResult
from core.types.SumRequest import SumRequest
from init_app import initApp

# serves static files and the api
backend = FastAPI(title="MUCGPT")
# serves the api
api_app = FastAPI(title="MUCGPT-API")
backend.mount("/api", api_app)

backend.state.app_config = initApp()
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, 'static')
backend.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


@api_app.exception_handler(AuthError)
async def handleAuthError(request, exc: AuthError):
    cfg = get_config()
    #return error.error, error.status_code
    return RedirectResponse(url=cfg["backend_config"].unauthorized_user_redirect_url,
                            status_code=302)


@api_app.post("/sum")
async def sum(
    body: str = Form(...),
    file: UploadFile = None, 
    id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token"),
    access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")  
) -> SummarizeResult:
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)
    sumRequest = SumRequest.model_validate(from_json(body))
    text =sumRequest.text if file is None else None
    if(file is not None):
        file_content = io.BytesIO(await file.read())
    else:
        file_content = None
    try:
        impl = cfg["sum_approaches"]
        splits = impl.split(detaillevel=sumRequest.detaillevel, file=file_content, text=text)
        r = await impl.summarize(
            splits=splits,
            department=department,
            language=sumRequest.language,
            llm_name=sumRequest.model,
        )
        return r
    except Exception as e:
        logging.exception("Exception in /sum")
        logging.exception(str(e))
        raise HTTPException(status_code=500,detail="Exception in summarize: something bad happened")

@api_app.post("/brainstorm")
async def brainstorm(request: BrainstormRequest,
                    id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token"),
                    access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> BrainstormResult:
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)
    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.brainstorm(
            topic=request.topic,
            language=request.language,
            department=department,
            llm_name=request.model
        )
        return r
    except Exception as e:
        logging.exception("Exception in /brainstorm")
        logging.exception(str(e))
        msg = (
            "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen."
            if "Rate limit" in str(e)
            else "Exception in brainstorm: something bad happened"
        )
        raise HTTPException(status_code=500,detail=msg)
    
@api_app.post("/simply")
async def simply(request: SimplyRequest,
                    id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token"),
                    access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> ChatResult:
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)
    try:
        impl = cfg["simply_approaches"]
        r = impl.simply(
            message=request.topic,
            department=department,
            llm_name=request.model,
            temperature=request.temperature,
            output_type=request.output_type
        )
        return r
    except Exception as e:
        logging.exception("Exception in /simply")
        msg = (
            "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen."
            if "Rate limit" in str(e)
            else str(e)
        )
        raise HTTPException(status_code=500,detail=msg)


@api_app.post("/chat_stream")
async def chat_stream(request: ChatRequest,
                      access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token"),
                      id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token")) -> StreamingResponse:
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)

    try:
        impl = cfg["chat_approaches"]
        response_generator = impl.run_with_streaming(
            history=request.history,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            system_message=request.system_message,
            model=request.model,
            department=department,
        )
        response = StreamingResponse(format_as_ndjson(response_generator))
        response.timeout = None  # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        logging.exception(str(e))
        raise HTTPException(status_code=500,detail="Exception in chat: something bad happened")


@api_app.post("/chat")
async def chat(request: ChatRequest,
               access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token"),
               id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token")) -> ChatResult:
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)
    try:
        impl = cfg["chat_approaches"]
        chatResult = impl.run_without_streaming(
            history=request.history,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            system_message=request.system_message,
            department=department,
            llm_name=request.model,
        )
        return chatResult
    except Exception as e:
        logging.exception("Exception in /chat")
        logging.exception(str(e))
        raise HTTPException(status_code=500,detail="Exception in chat: something bad happened")


@api_app.get("/config")
async def getConfig(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> ConfigResponse:
    cfg = get_config_and_authentificate(access_token)
    response = ConfigResponse(frontend=cfg["configuration_features"].frontend, version=cfg["configuration_features"].version)
    
    models = cast(
        List[ModelsConfig], cfg["configuration_features"].backend.models
    )
    for model in models:
        dto = ModelsDTO(
            llm_name=model.llm_name,
            max_output_tokens=model.max_output_tokens,
            max_input_tokens=model.max_input_tokens,
            description=model.description,
        )
        response.models.append(dto)
    return response


@api_app.get("/statistics")
async def getStatistics(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> StatisticsResponse:
    cfg = get_config_and_authentificate(access_token)
    repo = cfg["repository"]
    if(repo is None):
        raise HTTPException(status_code=501, detail="No database for logging statistics configured")
    else:
        try:  
            reponse = StatisticsResponse(sum=float(repo.sumByDepartment()), avg=float(repo.avgByDepartment()))
            return reponse
        except Exception as e:
            logging.exception(str(e))
            raise HTTPException(status_code=500, detail="Get Statistics failed!")


@api_app.post("/counttokens")
async def counttokens(request: CountTokenRequest, access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> CountResult:
    get_config_and_authentificate(access_token)
    try:
        counted_tokens = num_tokens_from_messages([HumanMessage(request.text)], request.model)
        return CountResult(count=counted_tokens)
    except NotImplementedError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logging.exception(str(e))
        raise HTTPException(status_code=500, detail="Counttokens failed!")

   


@api_app.get("/statistics/export")
async def getStatisticsCSV(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> FileResponse:
    cfg = get_config_and_authentificate(access_token)
    repo = cfg["repository"]
    if(repo is None):
        raise HTTPException(status_code=501, detail="No database for logging statistics configured")
    try:
        export = repo.export()
        return FileResponse(export, filename="statistics.csv", as_attachment=True)
    except Exception as e:
        logging.exception(str(e))
        raise HTTPException(status_code=500, detail=e)


@api_app.get("/health")
def health_check() -> str:
    return "OK"


def get_config():
    return cast(AppConfig, backend.state.app_config)


def get_config_and_authentificate(access_token):
    cfg = get_config()
    if cfg["configuration_features"].backend.enable_auth:
        ensure_authentification(access_token=access_token)
    return cfg


def ensure_authentification(access_token):
    cfg = get_config()
    auth_client: AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(accesstoken=access_token)
    return auth_client, claims


def get_department(id_token):
    cfg = get_config()

    if cfg["configuration_features"].backend.enable_auth:
        auth_client: AuthentificationHelper = cfg["authentification_client"]
        id_claims = auth_client.decode(id_token)
        return auth_client.getDepartment(claims=id_claims)
    else:
        return None
