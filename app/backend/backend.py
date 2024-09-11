import io
import logging
from contextlib import asynccontextmanager
from typing import List, cast

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
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
from core.types.ChatRequest import ChatRequest
from core.types.Config import ConfigResponse, ModelsConfig, ModelsDTO
from core.types.countresult import CountResult
from core.types.CountTokenRequest import CountTokenRequest
from core.types.StatisticsResponse import StatisticsResponse
from core.types.SumRequest import SumRequest
from init_app import initApp


@asynccontextmanager
async def lifespan(backend: FastAPI):
    backend.state.app_config = await initApp()
    yield


backend = FastAPI(title="MUCGPT", lifespan=lifespan)
backend.mount("/static", StaticFiles(directory="static"), name="static")
backend.state.app_config = None


@backend.exception_handler(AuthError)
async def handleAuthError(error: AuthError):
    return error.error, error.status_code


@backend.get("/", include_in_schema=False)
async def index(request: Request):
    get_config_and_authentificate(request)
    with open("static/index.html") as f:
        return HTMLResponse(content=f.read())


@backend.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return RedirectResponse(url="/static/favicon.ico")


@backend.get("/assets/{path}")
async def assets(request: Request, path: str):
    get_config_and_authentificate(request)
    return RedirectResponse(url="/static/assets/" + path)

@backend.post("/sum")
async def sum(
    body: str = Form(...),
    file: UploadFile = None, 
    id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token"),
    access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")  
):
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
        return JSONResponse(content=r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return JSONResponse({"error": str(e)}, status_code=500)
#TODO remove for prod
@backend.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logging.error(f"Error processing request: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})



@backend.post("/brainstorm")
async def brainstorm(request: Request,
                    id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token"),
                    access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")):
    cfg = get_config_and_authentificate(access_token=access_token)
    try:
        request_json = await request.json()
    except ValueError:
        return JSONResponse(content={"error": "request must be json"}, status_code=415)
    department = get_department(id_token=id_token)

    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.brainstorm(
            topic=request_json["topic"],
            language=request_json["language"] or "Deutsch",
            department=department,
            llm_name=request_json["model"] or "gpt-4o-mini",
        )
        return JSONResponse(r)
    except Exception as e:
        logging.exception("Exception in /brainstorm")
        msg = (
            "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen."
            if "Rate limit" in str(e)
            else str(e)
        )
        return JSONResponse({"error": msg}), 500


@backend.post("/chat_stream")
async def chat_stream(request: ChatRequest,
                      access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token"),
                      id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token")):
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)

    try:
        impl = cfg["chat_approaches"]
        response_generator = impl.run_with_streaming(
            history=request.history,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            system_message=request.system_message,
            model=request.model,
            department=department,
        )
        response = StreamingResponse(format_as_ndjson(response_generator))
        response.timeout = None  # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return JSONResponse({"error": str(e)}), 500


@backend.post("/chat")
async def chat(request: ChatRequest,
               access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token"),
               id_token: str = Header(None, alias= "X-Ms-Token-Lhmsso-Id-Token")):
    cfg = get_config_and_authentificate(access_token=access_token)
    department = get_department(id_token=id_token)
    try:
        impl = cfg["chat_approaches"]
        chatResult = impl.run_without_streaming(
            history=request.history,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            system_message=request.system_message,
            department=department,
            llm_name=request.model,
        )
        return JSONResponse(chatResult)
    except Exception as e:
        logging.exception("Exception in /chat")
        return JSONResponse({"error": str(e)}), 500


@backend.get("/config")
async def getConfig(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> ConfigResponse:
    cfg = get_config_and_authentificate(access_token)
    response = ConfigResponse(frontend=cfg["configuration_features"]["frontend"])
    models = cast(
        List[ModelsConfig], cfg["configuration_features"]["backend"]["models"]
    )
    for model in models:
        dto = ModelsDTO(
            llm_name=model["llm_name"],
            max_tokens=model["max_tokens"],
            description=model["description"],
        )
        response.models.append(dto)
    return response


@backend.get("/statistics", response_model=StatisticsResponse)
async def getStatistics(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> StatisticsResponse:
    try:
        cfg = get_config_and_authentificate(access_token)
        repo = cfg["repository"]
        reponse = StatisticsResponse(sum=float(repo.sumByDepartment()), avg=float(repo.avgByDepartment()))
        return reponse
    except Exception:
        raise HTTPException(status_code=404, detail="Get Statistics failed!")


@backend.post("/counttokens", response_model=CountResult)
async def counttokens(request: CountTokenRequest, access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")) -> CountResult:
    get_config_and_authentificate(access_token)
    counted_tokens = num_tokens_from_messages([HumanMessage(request.text)], request.model.llm_name)
    return CountResult(count=counted_tokens)


@backend.get("/statistics/export")
async def getStatisticsCSV(access_token: str = Header(None, alias="X-Ms-Token-Lhmsso-Access-Token")):
    try:
        cfg = get_config_and_authentificate(access_token)
        repo = cfg["repository"]
        export = repo.export()
        return FileResponse(export, filename="statistics.csv", as_attachment=True)
    except Exception as e:
        return JSONResponse(content={"error": e}, status_code=404)


@backend.get("/health")
def health_check():
    return "OK"


def get_config():
    return cast(AppConfig, backend.state.app_config)


def get_config_and_authentificate(access_token):
    cfg = get_config()
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(access_token=access_token)
    return cfg


def ensure_authentification(access_token):
    cfg = get_config()
    auth_client: AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(accesstoken=access_token)
    return auth_client, claims


def get_department(id_token):
    cfg = get_config()

    if cfg["configuration_features"]["backend"]["enable_auth"]:
        auth_client: AuthentificationHelper = cfg["authentification_client"]
        id_claims = auth_client.decode(id_token)
        return auth_client.getDepartment(claims=id_claims)
    else:
        return None
