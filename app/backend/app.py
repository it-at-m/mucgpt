import json
import logging
import os
import time
from typing import AsyncGenerator, cast
import base64 
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
from core.modelhelper import num_tokens_from_message
from core.llmhelper import createAzureChatGPT, getAzureChatGPT
from core.types.Chunk import Chunk
from core.datahelper import Repository, Base, Requestinfo
from core.authentification import AuthentificationHelper, AuthError
from core.confighelper import ConfigHelper
from core.types.AppConfig import AppConfig, OpenaiInfo
from core.textsplit import  splitPDF, splitText
from core.types.Config import BackendConfig

from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm

bp = Blueprint("routes", __name__, static_folder='static')

APPCONFIG_KEY = "APPCONFIG"


@bp.errorhandler(AuthError)
async def handleAuthError(error: AuthError):
    return error.error, error.status_code

@bp.route("/")
async def index():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    return await bp.send_static_file("index.html")

@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")

@bp.route("/assets/<path:path>")
async def assets(path):
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    return await send_from_directory("static/assets", path)


@bp.route("/sum", methods=["POST"])
async def sum():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    files = await request.files
    forms = await request.form
    
    request_json = json.loads(forms.get("body"))
    file = files.get("file", None)

    # detailed summarization summarizes lower chunks
    detaillevel = request_json["detaillevel"]
    switcher = {
        "short": 2100,
        "medium": 1500,
        "long": 700,
    }
    splitsize = switcher.get(detaillevel, 700)

   #TODO Wenn Cleanup tokenlimit sprengt, was machen? In mehreren Schritten übersetzen.
    if(file is not None):
        splits = splitPDF(file, splitsize, 0)
    else:
        text = request_json["text"]
        splits = splitText(text, splitsize, 0)

    department = get_department(request=request)

    try:
        impl = cfg["sum_approaches"]
        r = await impl.run(splits = splits, department=department, language=request_json["language"] or "Deutsch")
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500

@bp.route("/brainstorm", methods=["POST"])
async def brainstorm():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415

    request_json = await request.get_json()
    department = get_department(request=request)

    try:
        impl = cfg["brainstorm_approaches"]
        r = await impl.run(topic=request_json["topic"],language= request_json["language"] or "Deutsch", department=department)
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /brainstorm")
        msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen." if "Rate limit" in str(e) else str(e)
        return jsonify({"error": msg}), 500


async def format_as_ndjson(r: AsyncGenerator[Chunk, None]) -> AsyncGenerator[str, None]:
    try:
        async for event in r:
            yield json.dumps(event, ensure_ascii=False) + "\n"
    except Exception as e:
        logging.exception("Exception while generating response stream: %s", e)
        msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen." if "Rate limit" in str(e) else str(e)
        yield json.dumps(Chunk(type="E", message=msg))
        

@bp.route("/chat_stream", methods=["POST"])
async def chat_stream():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    department = get_department(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = cfg["chat_approaches"]
        temperature=request_json['temperature'] or 0.7
        max_tokens=request_json['max_tokens'] or 4096
        system_message = request_json['system_message'] or None
        response_generator = impl.run_with_streaming(history= request_json["history"],
                                                    temperature=temperature,
                                                    max_tokens=max_tokens,
                                                    system_message=system_message,
                                                    department= department)
        response = await make_response(format_as_ndjson(response_generator))
        response.timeout = None # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/config", methods=["GET"])
async def getConfig():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    return jsonify(cfg["configuration_features"])

@bp.route("/statistics", methods=["GET"])
async def getStatistics():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    repo = cfg["repository"]
    sum_by_department = repo.sumByDepartment()
    avg_by_department = repo.avgByDepartment()
    return jsonify({
        "sum": sum_by_department,
        "avg": avg_by_department
    })

@bp.route("/counttokens", methods=["POST"])
async def counttokens():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    
    model = cfg["model_info"]["model"]
    request_json = await request.get_json()
    message=request_json['text'] or ""
    counted_tokens = num_tokens_from_message(message,model)
    return jsonify({
        "count": counted_tokens
    })

@bp.route("/statistics/export", methods=["GET"])
async def getStatisticsCSV():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ensure_authentification(request=request)
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

@bp.route('/health',  methods=["GET"])
def health_check():
    return "OK"


@bp.route("/checkauth", methods=["GET"])
async def checkauth():
    auth_client, claims = ensure_authentification(request=request)
    return "OK"

@bp.route("/token", methods=["GET"])
async def readToken():
    principalID = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    principalName = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')
    idProviderId = request.headers.get('X-MS-CLIENT-PRINCIPAL-IDP')
    ssoidtoken = request.headers.get("X-Ms-Token-Lhmsso-Access-Token")
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
    ssoaccesstoken = request.headers.get("X-Ms-Token-Lhmsso-Access-Token")
    auth_client : AuthentificationHelper = cfg["authentification_client"]
    claims = auth_client.authentificate(ssoaccesstoken)
    return auth_client,claims

def get_department(request: request):
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    if cfg["configuration_features"]["backend"]["enable_auth"]:
        ssoidtoken = request.headers.get('X-Ms-Token-Lhmsso-Id-Token')
        auth_client : AuthentificationHelper = cfg["authentification_client"]
        id_claims = auth_client.decode(ssoidtoken)
        return auth_client.getDepartment(claims=id_claims)
    else:
        return None



@bp.before_request
async def ensure_openai_token():
    cfg = cast(AppConfig, current_app.config[APPCONFIG_KEY])
    openai_token = cfg["model_info"]["openai_token"]
    if openai_token.expires_on < time.time() + 60:
        openai_token = await cfg["azure_credential"].get_token("https://cognitiveservices.azure.com/.default")
        # new token, 
        cfg["model_info"]["openai_token"] = openai_token
        cfg["model_info"]["openai_api_key"] = openai_token.token
        (chat_approaches, brainstorm_approaches, sum_approaches) = initApproaches(model_info=cfg["model_info"], cfg=cfg["backend_config"], repoHelper=cfg["repository"])
        cfg["chat_approaches"] = chat_approaches
        cfg["brainstorm_approaches"]  = brainstorm_approaches
        cfg["sum_approaches"] = sum_approaches



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
    openai_api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
    openai_api_version = "2023-05-15"
    openai_api_type = "azure_ad"
    openai_token = await azure_credential.get_token(
        "https://cognitiveservices.azure.com/.default"
    )
    openai_api_key = openai_token.token
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
    model_info = OpenaiInfo(
            model=AZURE_OPENAI_CHATGPT_MODEL,
            openai_token = openai_token,
            openai_api_key =  openai_api_key,
            openai_api_base =  openai_api_base,
            openai_api_version =  openai_api_version,
            openai_api_type = openai_api_type
        )

    (chat_approaches, brainstorm_approaches, sum_approaches) = initApproaches(model_info=model_info, cfg=cfg["backend"], repoHelper=repoHelper)

    current_app.config[APPCONFIG_KEY] = AppConfig(
        model_info= model_info,
        azure_credential=azure_credential,
        authentification_client=auth_helper,
        configuration_features=cfg,
        chat_approaches= chat_approaches,
        brainstorm_approaches= brainstorm_approaches,
        sum_approaches= sum_approaches,
        repository=repoHelper,
        backend_config=cfg["backend"]
    )
    if cfg["backend"]["enable_database"]:
        repoHelper.setup_schema(base=Base)

def initApproaches(model_info: OpenaiInfo, cfg: BackendConfig, repoHelper: Repository):
    brainstormllm = getAzureChatGPT(
                    chatgpt_model=  model_info["model"],
                    max_tokens =  4000,
                    n = 1,
                    openai_api_key =  model_info["openai_api_key"],
                    openai_api_base =  model_info["openai_api_base"],
                    openai_api_version =   model_info["openai_api_version"],
                    openai_api_type =  model_info["openai_api_type"],
                    temperature=0.9)
    sumllm = getAzureChatGPT(
                    chatgpt_model=  model_info["model"],
                    max_tokens =  1000,
                    n = 1,
                    openai_api_key =  model_info["openai_api_key"],
                    openai_api_base =   model_info["openai_api_base"],
                    openai_api_version =   model_info["openai_api_version"],
                    openai_api_type =  model_info["openai_api_type"],
                    temperature=0.7)
    chatlllm = createAzureChatGPT(
                    chatgpt_model=  model_info["model"],
                    n = 1,
                    openai_api_key =  model_info["openai_api_key"],
                    openai_api_base =  model_info["openai_api_base"],
                    openai_api_version =   model_info["openai_api_version"],
                    openai_api_type = model_info["openai_api_type"])
    chat_approaches = SimpleChatApproach(createLLM=chatlllm, config=cfg["chat"], repo=repoHelper, chatgpt_model=model_info["model"])
    brainstorm_approaches = Brainstorm(llm=brainstormllm, config=cfg["brainstorm"], repo=repoHelper)
    sum_approaches =  Summarize(llm=sumllm, config=cfg["sum"], repo=repoHelper)
    return (chat_approaches, brainstorm_approaches, sum_approaches)



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
