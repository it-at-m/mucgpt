import json
import logging
from contextlib import asynccontextmanager
from typing import List, cast

from fastapi.responses import FileResponse
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from langchain_core.messages.human import HumanMessage

from core.authentification import AuthentificationHelper, AuthError
from core.helper import format_as_ndjson
from core.modelhelper import num_tokens_from_messages
from core.types.AppConfig import AppConfig
from core.types.Config import ModelsConfig, ModelsDTO
from core.types.countresult import CountResult
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
    request: Request,
    file: UploadFile = File(None), 
    body: str = Form(...), 
):
    cfg = get_config_and_authentificate(request)
    department = get_department(request=request)
    try:
        request_json = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON in body"}, status_code=415)
    text = request_json.get("text") if file is None else None
    detaillevel = request_json.get("detaillevel")
    language = request_json.get("language")
    model = request_json.get("model")
    try:
        impl = cfg["sum_approaches"]
        splits = impl.split(detaillevel=detaillevel, file=file, text=text)
        r = await impl.summarize(
            splits=splits,
            department=department,
            language=language,
            model_name=model,
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
async def brainstorm(request: Request):
    cfg = get_config_and_authentificate(request)
    try:
        request_json = await request.json()
    except ValueError:
        return JSONResponse(content={"error": "request must be json"}, status_code=415)
    department = get_department(request=request)

    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.brainstorm(
            topic=request_json["topic"],
            language=request_json["language"] or "Deutsch",
            department=department,
            model_name=request_json["model"] or "gpt-4o-mini",
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
async def chat_stream(request: Request):
    cfg = get_config_and_authentificate(request)
    department = get_department(request=request)

    try:
        request_json = await request.json()
    except ValueError:
        return JSONResponse(content={"error": "request must be json"}, status_code=415)
    try:
        impl = cfg["chat_approaches"]
        temperature = request_json["temperature"] or 0.7
        max_tokens = request_json["max_tokens"] or 4096
        system_message = request_json["system_message"] or None
        model = request_json["model"] or "gpt-4o-mini"
        response_generator = impl.run_with_streaming(
            history=request_json["history"],
            temperature=temperature,
            max_tokens=max_tokens,
            system_message=system_message,
            model=model,
            department=department,
        )
        response = StreamingResponse(format_as_ndjson(response_generator))
        response.timeout = None  # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return JSONResponse({"error": str(e)}), 500


@backend.post("/chat")
async def chat(request: Request):
    cfg = get_config_and_authentificate(request)
    department = get_department(request=request)
        
    try:
        request_json = await request.json()
    except ValueError:
        return JSONResponse(content={"error": "request must be json"}, status_code=415)
    try:
        impl = cfg["chat_approaches"]
        temperature = request_json["temperature"] or 0.7
        max_tokens = request_json["max_tokens"] or 4096
        model_name = request_json["model"] or "gpt-4o-mini"
        system_message = request_json["system_message"] or None
        history = request_json["history"]
        chatResult = impl.run_without_streaming(
            history=history,
            temperature=temperature,
            max_tokens=max_tokens,
            system_message=system_message,
            department=department,
            model_name=model_name,
        )
        return JSONResponse(chatResult)
    except Exception as e:
        logging.exception("Exception in /chat")
        return JSONResponse({"error": str(e)}), 500


@backend.get("/config")
async def getConfig(request: Request):
    cfg = get_config_and_authentificate(request)
    frontend_features = cfg["configuration_features"]["frontend"]
    models = cast(
        List[ModelsConfig], cfg["configuration_features"]["backend"]["models"]
    )
    models_dto_list = []
    for model in models:
        dto = ModelsDTO(
            model_name=model["model_name"],
            max_tokens=model["max_tokens"],
            description=model["description"],
        )
        models_dto_list.append(dto)
    return JSONResponse({"frontend": frontend_features, "models": models_dto_list})


@backend.get("/statistics")
async def getStatistics(request: Request):
    cfg = get_config_and_authentificate(request)
    repo = cfg["repository"]
    sum_by_department = repo.sumByDepartment()
    avg_by_department = repo.avgByDepartment()
    return JSONResponse({"sum": float(sum_by_department), "avg": float(avg_by_department)})


@backend.post("/counttokens")
async def counttokens(request: Request):
    get_config_and_authentificate(request)
    request_json = await request.get_json()
    message = request_json["text"] or ""
    model = request_json["model"]["model_name"] or "gpt-4o-mini"
    counted_tokens = num_tokens_from_messages([HumanMessage(message)], model)
    return JSONResponse(CountResult(count=counted_tokens))


@backend.get("/statistics/export")
async def getStatisticsCSV(request: Request):
    cfg = get_config_and_authentificate(request)
    repo = cfg["repository"]
    export = repo.export()
    return FileResponse(export, filename="statistics.csv", as_attachment=True)


@backend.get("/health")
def health_check():
    return "OK"


def get_config():
    return cast(AppConfig, backend.state.app_config)


def get_config_and_authentificate(request: Request):
    cfg = get_config()
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    return cfg


def ensure_authentification(request: Request):
    cfg = get_config()
    ssoaccesstoken = request.headers.get("X-Ms-Token-Lhmsso-Access-Token")
    auth_client: AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(ssoaccesstoken)
    return auth_client, claims


def get_department(request: Request):
    cfg = get_config()

    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ssoidtoken = request.headers.get("X-Ms-Token-Lhmsso-Id-Token")
        auth_client: AuthentificationHelper = cfg["authentification_client"]
        id_claims = auth_client.decode(ssoidtoken)
        return auth_client.getDepartment(claims=id_claims)
    else:
        return None
