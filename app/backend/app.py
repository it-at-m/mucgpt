import json
import logging
import os
import time
from typing import AsyncGenerator, cast
import base64 

import openai
import csv
import io
from azure.identity.aio import DefaultAzureCredential
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from quart import (
    Blueprint,
    Quart,
    current_app,
    jsonify,
    make_response,
    request,
    send_from_directory,
    send_file
)
from core.datahelper import Repository, Base, Requestinfo
from core.authentification import AuthentificationHelper, AuthError
from core.confighelper import ConfigHelper
from core.types.AppConfig import AppConfig
from core.textsplit import readPDF, textToDocs

from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm

bp = Blueprint("routes", __name__, static_folder='static')

APPCONFIG_KEY = "APPCONFIG"

def exclude_from_authentification(func):
    func._exclude_from_authentification = True
    return func


@bp.errorhandler(AuthError)
async def handleAuthError(error: AuthError):
    return error.error, error.status_code

@bp.route("/")
async def index():
    return await bp.send_static_file("index.html")

@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")

@bp.route("/assets/<path:path>")
async def assets(path):
    return await send_from_directory("static/assets", path)


@bp.route("/chat", methods=["POST"])
async def chat():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415

    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    request_json = await request.get_json()
    try:
        impl = cfg["chat_approaches"]
        # Workaround for: https://github.com/openai/openai-python/issues/371
        r = await impl.run_without_streaming(request_json.get("history", []), request_json.get("overrides", {}))
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/sum", methods=["POST"])
async def sum():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    files = await request.files
    forms = await request.form
    
    request_json = json.loads(forms.get("body"))
    file = files.get("file", None)

    if(file is not None):
        docs = readPDF(file, 3000, 0)
    else:
        text = request_json["text"]
        docs = textToDocs(text, 3000, 0)

    department = get_department(request=request)

    try:
        impl = cfg["sum_approaches"]
        r = await impl.run(docs = docs, overrides=request_json["overrides"] or {}, department=department)
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500

@bp.route("/brainstorm", methods=["POST"])
async def brainstorm():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415

    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    request_json = await request.get_json()
    department = get_department(request=request)

    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.run(topic=request_json["topic"],overrides= request_json ["overrides"] or {}, department=department)
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500


async def format_as_ndjson(r: AsyncGenerator[dict, None]) -> AsyncGenerator[str, None]:
    async for event in r:
        yield json.dumps(event, ensure_ascii=False) + "\n"
        

@bp.route("/chat_stream", methods=["POST"])
async def chat_stream():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    department = get_department(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = cfg["chat_approaches"]
        response_generator = impl.run_with_streaming(history= request_json["history"], overrides= request_json.get("overrides", {}), department= department)
        response = await make_response(format_as_ndjson(response_generator))
        response.timeout = None # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/config", methods=["GET"])
async def getConfig():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    return jsonify(cfg["configuration_features"])

@bp.route("/statistics", methods=["GET"])
async def getStatistics():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    repo = cfg["repository"]
    sum_by_department = repo.sumByDepartment()
    avg_by_department = repo.avgByDepartment()
    return jsonify({
        "sum": sum_by_department,
        "avg": avg_by_department
    })

@bp.route("/statistics/export", methods=["GET"])
async def getStatisticsCSV():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    repo = cfg["repository"]

    memfile = io.StringIO()
    outcsv = csv.writer(memfile, delimiter=',',quotechar='"', quoting = csv.QUOTE_MINIMAL)
    outcsv.writerow([column.name for column in Requestinfo.__mapper__.columns])
    [outcsv.writerow([getattr(curr, column.name) for column in Requestinfo.__mapper__.columns]) for curr in repo.getAll()]

    memfile.seek(0)
    # Das StringIO-Objekt in ein BytesIO-Objekt umwandeln
    memfile_bytesio = io.BytesIO(memfile.getvalue().encode())
    memfile_bytesio.getvalue()
    return await send_file(memfile_bytesio,
                 attachment_filename='statistics.csv',
                 as_attachment=True)

@exclude_from_authentification
@bp.route('/health',  methods=["GET"])
def health_check():
    return "OK"


@bp.route("/token", methods=["GET"])
async def readToken():
    principalID = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    principalName = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')
    idProviderId = request.headers.get('X-MS-CLIENT-PRINCIPAL-IDP')
    ssoidtoken = request.headers.get('X-Ms-Token-Ssotest-Id-Token')
    clientPrincipal = request.headers.get('X-MS-CLIENT-PRINCIPAL')
    clientPrincipal= base64.b64decode(clientPrincipal)

    auth_client, claims = ensure_authentification(request=request)

    id_claims = auth_client.decode(ssoidtoken)

    result = "\n"
    myDict = sorted(dict(request.headers))
    for key in myDict:
        result += f"{key} = {dict(request.headers)[key]}\n"

    response = await make_response(f"Hi {auth_client.getName(claims=claims)} aus {auth_client.getDepartment(claims=id_claims)}"+
        f"\n\nHier sind deine Client Principals von Azure:"+ 
        f"\nThis is your X-MS-CLIENT-PRINCIPAL-ID: {principalID}"+
        f"\nThis is your X-MS-CLIENT-PRINCIPAL-NAME: {principalName}"+
        f"\nThis is your X-MS-CLIENT-PRINCIPAL-IDP: {idProviderId}"+
        f"\nThis is your X-MS-CLIENT-PRINCIPAL: {clientPrincipal}"+
        f"\n\nJetzt gehts um deine Rollen:"+
        f"\n\nRollen: {auth_client.getRoles(claims)}"+
        f"\n\n\n Und alle Daten: {result}", 200)

    response.mimetype = "text/plain"
    return response

def ensure_authentification(request: request):
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    ssoaccesstoken = request.headers.get("X-Ms-Token-Ssotest-Access-Token")
    auth_client : AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(ssoaccesstoken)
    return auth_client,claims

def get_department(request: request):
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    ssoidtoken = request.headers.get('X-Ms-Token-Ssotest-Id-Token')
    auth_client : AuthentificationHelper = cfg["authentification_client"]
    id_claims = auth_client.decode(ssoidtoken)
    return auth_client.getDepartment(claims=id_claims)

@bp.before_app_request
async def check_authentification(*args, **kwargs):
    _exclude_from_authentification = False
    if request.endpoint in current_app.view_functions:
        view_func = current_app.view_functions[request.endpoint]
        _exclude_from_authentification = not hasattr(view_func, '_exclude_from_authentification')
    if(not exclude_from_authentification):
        cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
        if cfg["configuration_features"]["backend"]["enable_auth"]:
            ensure_authentification(request=request)


@bp.before_request
async def ensure_openai_token():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    openai_token = cfg["openai_token"]
    if openai_token.expires_on < time.time() + 60:
        openai_token = await cfg["azure_credential"].get_token("https://cognitiveservices.azure.com/.default")
        cfg["openai_token"] = openai_token
        openai.api_key = openai_token.token


@bp.before_app_serving
async def setup_clients():

    # Replace these with your own values, either in environment variables or directly here
    AZURE_OPENAI_SERVICE = os.environ["AZURE_OPENAI_SERVICE"]
    AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ["AZURE_OPENAI_CHATGPT_DEPLOYMENT"]
    AZURE_OPENAI_CHATGPT_MODEL = os.environ["AZURE_OPENAI_CHATGPT_MODEL"]
    SSO_ISSUER = os.environ["SSO_ISSUER"]
    CONFIG_NAME = os.environ["CONFIG_NAME"]
    DB_HOST = os.environ["DB_HOST"]
    DB_NAME = os.environ["DB_NAME"]
    DB_USER = os.environ["DB_USER"]
    DB_PASSWORD = os.environ["DB_PASSWORD"]

    # Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed,
    # just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the
    # keys for each service
    # If you encounter a blocking error during a DefaultAzureCredential resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
    azure_credential = DefaultAzureCredential(exclude_shared_token_cache_credential = True)

    # Used by the OpenAI SDK
    openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
    openai.api_version = "2023-05-15"
    openai.api_type = "azure_ad"
    openai_token = await azure_credential.get_token(
        "https://cognitiveservices.azure.com/.default"
    )
    openai.api_key = openai_token.token

     # Set up authentication helper
    auth_helper = AuthentificationHelper(
        issuer=SSO_ISSUER,
        role="lhm-ab-mucgpt-user"
    )  

    repoHelper = Repository(
        username=DB_USER,
        host=DB_HOST,
        database=DB_NAME,
        password=DB_PASSWORD
    )


    config_helper = ConfigHelper(base_path=os.getcwd()+"/ressources/", env=CONFIG_NAME, base_config_name="base")
    cfg = config_helper.loadData()

    current_app.config[APPCONFIG_KEY] = AppConfig(
        openai_token=openai_token,
        azure_credential=azure_credential,
        authentification_client=auth_helper,
        configuration_features=cfg,
        chat_approaches= SimpleChatApproach(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL, config=cfg["backend"]["chat"], repo=repoHelper),
        brainstorm_approaches= Brainstorm(chatgpt_deployment= AZURE_OPENAI_CHATGPT_DEPLOYMENT, chatgpt_model=AZURE_OPENAI_CHATGPT_MODEL, config=cfg["backend"]["brainstorm"], repo=repoHelper),
        sum_approaches=  Summarize(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL, config=cfg["backend"]["sum"], repo=repoHelper),
        repository=repoHelper
    )
    if cfg["backend"]["enable_database"]:
        repoHelper.setup_schema(base=Base)



def create_app():
    if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
        configure_azure_monitor()
        AioHttpClientInstrumentor().instrument()
    app = Quart(__name__)
    app.register_blueprint(bp)
    app.asgi_app = OpenTelemetryMiddleware(app.asgi_app)
    # Level should be one of https://docs.python.org/3/library/logging.html#logging-levels
    logging.basicConfig(level=os.getenv("APP_LOG_LEVEL", "ERROR"))
    return app
