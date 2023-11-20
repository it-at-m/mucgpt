import json
import logging
import os
import time
from typing import AsyncGenerator
import base64 

import aiohttp
import openai
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
)
from core.datahelper import Repository, Base
from core.authentification import AuthentificationHelper, AuthError
from core.confighelper import ConfigHelper

from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm

CONFIG_OPENAI_TOKEN = "openai_token"
CONFIG_CREDENTIAL = "azure_credential"
CONFIG_ASK_APPROACHES = "ask_approaches"
CONFIG_CHAT_APPROACHES = "chat_approaches"
CONFIG_SUM_APPROACHES = "sum_approaches"
CONFIG_BRAINSTORM_APPROACHES = "brainstorm_approaches"
CONFIG_AUTH = "authentification_client"
CONFIG_FEATURES = "configuration_features"

bp = Blueprint("routes", __name__, static_folder='static')

@bp.errorhandler(AuthError)
async def handleAuthError(error: AuthError):
    return error.error, error.status_code

@bp.route("/")
async def index():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)

    return await bp.send_static_file("index.html")

@bp.route("/favicon.ico")
async def favicon():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)
    return await bp.send_static_file("favicon.ico")

@bp.route("/assets/<path:path>")
async def assets(path):
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)
    return await send_from_directory("static/assets", path)


@bp.route("/chat", methods=["POST"])
async def chat():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = current_app.config[CONFIG_CHAT_APPROACHES]
        # Workaround for: https://github.com/openai/openai-python/issues/371
        async with aiohttp.ClientSession() as s:
            openai.aiosession.set(s)
            r = await impl.run_without_streaming(request_json.get("history", []), request_json.get("overrides", {}))
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/sum", methods=["POST"])
async def sum():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    try:
        impl = current_app.config[CONFIG_SUM_APPROACHES]
        async with aiohttp.ClientSession() as s:
            openai.aiosession.set(s)
            r = await impl.run(request_json["text"], request_json["overrides"] or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500

@bp.route("/brainstorm", methods=["POST"])
async def brainstorm():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()

    try:
        impl = current_app.config[CONFIG_BRAINSTORM_APPROACHES]
        async with aiohttp.ClientSession() as s:
            openai.aiosession.set(s)
            r = await impl.run(request_json["topic"], request_json ["overrides"] or {})
        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /sum")
        return jsonify({"error": str(e)}), 500


async def format_as_ndjson(r: AsyncGenerator[dict, None]) -> AsyncGenerator[str, None]:
    async for event in r:
        yield json.dumps(event, ensure_ascii=False) + "\n"
        

@bp.route("/chat_stream", methods=["POST"])
async def chat_stream():
    if current_app.config[CONFIG_FEATURES]["backend"]["features"]["enable_auth"]:
        ensure_authentification(request=request)

    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    request_json = await request.get_json()
    approach = request_json["approach"]
    try:
        impl = current_app.config[CONFIG_CHAT_APPROACHES]
        response_generator = impl.run_with_streaming(request_json["history"], request_json.get("overrides", {}))
        response = await make_response(format_as_ndjson(response_generator))
        response.timeout = None # type: ignore
        return response
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500

@bp.route("/config", methods=["GET"])
async def getConfig():
    return jsonify(current_app.config[CONFIG_FEATURES])

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
    ssoaccesstoken = request.headers.get("X-Ms-Token-Ssotest-Access-Token")
    auth_client : AuthentificationHelper = current_app.config[CONFIG_AUTH]
    claims = auth_client.authentificate(ssoaccesstoken)
    return auth_client,claims


@bp.before_request
async def ensure_openai_token():
    openai_token = current_app.config[CONFIG_OPENAI_TOKEN]
    if openai_token.expires_on < time.time() + 60:
        openai_token = await current_app.config[CONFIG_CREDENTIAL].get_token("https://cognitiveservices.azure.com/.default")
        current_app.config[CONFIG_OPENAI_TOKEN] = openai_token
        openai.api_key = openai_token.token


@bp.before_app_serving
async def setup_clients():

    # Replace these with your own values, either in environment variables or directly here
    AZURE_OPENAI_SERVICE = os.environ["AZURE_OPENAI_SERVICE"]
    AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ["AZURE_OPENAI_CHATGPT_DEPLOYMENT"]
    AZURE_OPENAI_CHATGPT_MODEL = os.environ["AZURE_OPENAI_CHATGPT_MODEL"]
    SSO_ISSUER = os.environ["SSO_ISSUER"]
    CONFIG_NAME = os.environ["CONFIG_NAME"]


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
    
    config_helper = ConfigHelper(base_path=os.getcwd()+"/ressources/", env=CONFIG_NAME, base_config_name="base")

    # Store on app.config for later use inside requests
    current_app.config[CONFIG_OPENAI_TOKEN] = openai_token
    current_app.config[CONFIG_CREDENTIAL] = azure_credential

    current_app.config[CONFIG_CHAT_APPROACHES] = SimpleChatApproach(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)
    current_app.config[CONFIG_BRAINSTORM_APPROACHES] = Brainstorm(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)
    current_app.config[CONFIG_SUM_APPROACHES] =  Summarize(AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL)

    current_app.config[CONFIG_AUTH] = auth_helper
    current_app.config[CONFIG_FEATURES] = config_helper.loadData()


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
