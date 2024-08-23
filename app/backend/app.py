import json
import logging
import os
from typing import List, cast
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from quart import (
    Blueprint,
    Quart,
    Request,
    current_app,
    jsonify,
    make_response,
    request,
    send_file,
    send_from_directory,
)
from langchain_core.messages.human import HumanMessage
from core.modelhelper import num_tokens_from_messages
from core.types.Config import ModelsConfig, ModelsDTO
from core.authentification import AuthentificationHelper, AuthError
from core.helper import format_as_ndjson
from core.types.AppConfig import AppConfig
from core.types.countresult import CountResult
from init_app import initApp

bp = Blueprint("routes", __name__, static_folder='static')

APPCONFIG_KEY = "APPCONFIG"


@bp.errorhandler(AuthError)
async def handleAuthError(error: AuthError):
    return error.error, error.status_code

@bp.route("/")
async def index():
    get_config_and_authentificate()
    return await bp.send_static_file("index.html")

@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")

@bp.route("/assets/<path:path>")
async def assets(path):
    get_config_and_authentificate()
    return await send_from_directory("static/assets", path)


@bp.route("/sum", methods=["POST"])
async def sum():
    cfg = get_config_and_authentificate()
    department = get_department(request=request)

    files = await request.files
    forms = await request.form
    
    request_json = json.loads(forms.get("body"))
    file = files.get("file", None)
    detaillevel = request_json["detaillevel"]
    try:
        
        impl = cfg["sum_approaches"]
        text = request_json["text"] if file is None else None
        splits = impl.split(detaillevel=detaillevel, file=file, text=text)

        r = await impl.summarize(splits = splits, department=department, language=request_json["language"] or "Deutsch")
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500

@bp.route("/brainstorm", methods=["POST"])
async def brainstorm():
    cfg = get_config_and_authentificate()
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415

    request_json = await request.get_json()
    department = get_department(request=request)

    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.brainstorm(topic=request_json["topic"],language= request_json["language"] or "Deutsch", department=department)
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /brainstorm")
        msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen." if "Rate limit" in str(e) else str(e)
        return jsonify({"error": msg}), 500

@bp.route("/chat_stream", methods=["POST"])
async def chat_stream():
    cfg = get_config_and_authentificate()
    department = get_department(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = cfg["chat_approaches"]
        temperature=request_json['temperature'] or 0.7
        max_tokens=request_json['max_tokens'] or 4096
        system_message = request_json['system_message'] or None
        model = request_json['model']
        response_generator = impl.run_with_streaming(history= request_json["history"],
                                                    temperature=temperature,
                                                    max_tokens=max_tokens,
                                                    system_message=system_message,
                                                    model=model,
                                                    department= department)
        response = await make_response(format_as_ndjson(response_generator))
        response.timeout = None # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500
    
@bp.route("/chat", methods=["POST"])
async def chat():
    cfg = get_config_and_authentificate()
    department = get_department(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = cfg["chat_approaches"]
        temperature=request_json['temperature'] or 0.7
        max_tokens=request_json['max_tokens'] or 4096
        system_message = request_json['system_message'] or None
        history =  request_json["history"]
        chatResult = impl.run_without_streaming(history= history,
                                                    temperature=temperature,
                                                    max_tokens=max_tokens,
                                                    system_message=system_message,
                                                    department= department)
        return jsonify(chatResult)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/config", methods=["GET"])
async def getConfig():
    cfg = get_config_and_authentificate()
    frontend_features = cfg["configuration_features"]["frontend"]
    models= cast(List[ModelsConfig], cfg["configuration_features"]["backend"]["models"])
    models_dto_list = []
    for model in models:
        dto = ModelsDTO(model_name=model["model_name"], max_tokens=model["max_tokens"])
        models_dto_list.append(dto)
    return jsonify({
        "frontend": frontend_features,
        "models": models_dto_list
    })

@bp.route("/statistics", methods=["GET"])
async def getStatistics():
    cfg = get_config_and_authentificate()
    repo = cfg["repository"]
    sum_by_department = repo.sumByDepartment()
    avg_by_department = repo.avgByDepartment()
    return jsonify({
        "sum": sum_by_department,
        "avg": avg_by_department
    })

@bp.route("/counttokens", methods=["POST"])
async def counttokens():
    cfg = get_config_and_authentificate()
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    
    request_json = await request.get_json()
    message=request_json['text'] or ""
    model = request_json['model']['model_name'] or "gpt-35-turbo"
    counted_tokens = num_tokens_from_messages([HumanMessage(message)], model)
    return jsonify(CountResult(count=counted_tokens))

@bp.route("/statistics/export", methods=["GET"])
async def getStatisticsCSV():
    cfg = get_config_and_authentificate()
    repo = cfg["repository"]
    export = repo.export()
    return await send_file(export,
                 attachment_filename='statistics.csv',
                 as_attachment=True)

@bp.route('/health',  methods=["GET"])
def health_check():
    return "OK"

def get_config():
    return cast(AppConfig, current_app.config[APPCONFIG_KEY])

def get_config_and_authentificate():
    cfg = get_config()
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    return cfg

def ensure_authentification(request: Request):
    cfg = get_config()
    ssoaccesstoken = request.headers.get("X-Ms-Token-Lhmsso-Access-Token")
    auth_client : AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(ssoaccesstoken)
    return auth_client,claims

def get_department(request: Request):
    cfg = get_config()
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ssoidtoken = request.headers.get('X-Ms-Token-Lhmsso-Id-Token')
        auth_client : AuthentificationHelper = cfg["authentification_client"]
        id_claims = auth_client.decode(ssoidtoken)
        return auth_client.getDepartment(claims=id_claims)
    else:
        return None
    
@bp.before_app_serving
async def setup_clients():
    current_app.config[APPCONFIG_KEY] = await initApp()

def create_app():
    app = Quart(__name__)
    app.register_blueprint(bp)
    app.asgi_app = OpenTelemetryMiddleware(app = app.asgi_app)
    # Level should be one of https://docs.python.org/3/library/logging.html#logging-levels
    logging.basicConfig(level=os.getenv("APP_LOG_LEVEL", "ERROR"))
    return app
