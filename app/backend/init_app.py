import os
from typing import Tuple
from core.types.AzureChatGPTConfig import AzureChatGPTConfig
from core.types.Config import BackendConfig
from core.llmhelper import getModel
from core.datahelper import Repository, Base
from core.authentification import AuthentificationHelper
from core.confighelper import ConfigHelper
from core.types.AppConfig import AppConfig
from summarize.summarize import Summarize
from chat.chat import Chat
from brainstorm.brainstorm import Brainstorm
from azure.identity.aio import DefaultAzureCredential

def read_env():
    """reads configured values from env
    """
    AZURE_OPENAI_SERVICE = os.environ["AZURE_OPENAI_SERVICE"]
    #AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ["AZURE_OPENAI_CHATGPT_DEPLOYMENT"]
    AZURE_OPENAI_CHATGPT_MODEL = os.environ["AZURE_OPENAI_CHATGPT_MODEL"]
    SSO_ISSUER = os.environ["SSO_ISSUER"]
    CONFIG_NAME = os.environ["CONFIG_NAME"]
    DB_HOST = os.environ["DB_HOST"]
    DB_NAME = os.environ["DB_NAME"]
    DB_USER = os.environ["DB_USER"]
    DB_PASSWORD = os.environ["DB_PASSWORD"]
    return AZURE_OPENAI_SERVICE,AZURE_OPENAI_CHATGPT_MODEL,SSO_ISSUER,CONFIG_NAME,DB_HOST,DB_NAME,DB_USER,DB_PASSWORD


async def get_openai_params(AZURE_OPENAI_SERVICE: str):
    """get current openai access token

    Args:
        AZURE_OPENAI_SERVICE (str): the current openaiservice
    """
    # Use the current user identity to authenticate with Azure OpenAI (no secrets needed,
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
    return azure_credential,openai_api_base,openai_api_version,openai_api_type,openai_token,openai_api_key


def initApproaches(model_info: AzureChatGPTConfig, cfg: BackendConfig, repoHelper: Repository) -> Tuple[Chat, Brainstorm, Summarize]:
    """init different approaches

    Args:
        model_info (AzureChatGPTConfig): defines access key for the current model, gets renewed over time
        cfg (BackendConfig): the config for the backend
        repoHelper (Repository): the repository to save request statistics

    Returns:
        Tuple[Chat, Brainstorm, Summarize]: the implementation behind chat, brainstorm and summarize
    """
    brainstormllm = getModel(
                    chatgpt_model=  model_info["model"],
                    max_tokens =  4000,
                    n = 1,
                    api_key =  model_info["openai_api_key"],
                    api_base =  model_info["openai_api_base"],
                    api_version =   model_info["openai_api_version"],
                    api_type =  model_info["openai_api_type"],
                    streaming=False,
                    temperature=0.9)
    sumllm = getModel(
                    chatgpt_model=  model_info["model"],
                    max_tokens =  1000,
                    n = 1,
                    api_key =  model_info["openai_api_key"],
                    api_base =   model_info["openai_api_base"],
                    api_version =   model_info["openai_api_version"],
                    api_type =  model_info["openai_api_type"],
                    streaming=False,
                    temperature=0.7)
    chatlllm = getModel(
                    chatgpt_model=  model_info["model"],
                    max_tokens=4000,
                    n = 1,
                    api_key =  model_info["openai_api_key"],
                    api_base =  model_info["openai_api_base"],
                    api_version =   model_info["openai_api_version"],
                    api_type = model_info["openai_api_type"],
                    streaming=True,
                    temperature=0.7)
    chat_approaches = Chat(llm=chatlllm, config=cfg["chat"], model_info=model_info, repo=repoHelper, chatgpt_model=model_info["model"])
    brainstorm_approaches = Brainstorm(llm=brainstormllm, model_info=model_info, config=cfg["brainstorm"], repo=repoHelper)
    sum_approaches =  Summarize(llm=sumllm, config=cfg["sum"],model_info=model_info, repo=repoHelper)
    return (chat_approaches, brainstorm_approaches, sum_approaches)

async def initApp() -> AppConfig:
    """inits the app

    Returns:
        AppConfig: contains the configuration for the webservice
    """
    # Replace these with your own values, either in environment variables or directly here
    AZURE_OPENAI_SERVICE, AZURE_OPENAI_CHATGPT_MODEL, SSO_ISSUER, CONFIG_NAME, DB_HOST, DB_NAME, DB_USER, DB_PASSWORD = read_env()

    azure_credential, openai_api_base, openai_api_version, openai_api_type, openai_token, openai_api_key = await get_openai_params(AZURE_OPENAI_SERVICE)
     # Set up authentication helper
    auth_helper = AuthentificationHelper(
        issuer=SSO_ISSUER,
        role="lhm-ab-mucgpt-user"
    )  
    # set up repositorty
    repoHelper = Repository(
        username=DB_USER,
        host=DB_HOST,
        database=DB_NAME,
        password=DB_PASSWORD
    )
    # read enviornment config
    config_helper = ConfigHelper(base_path=os.getcwd()+"/ressources/", env=CONFIG_NAME, base_config_name="base")
    cfg = config_helper.loadData()
    
    model_info = AzureChatGPTConfig(
            model=AZURE_OPENAI_CHATGPT_MODEL,
            openai_token = openai_token,
            openai_api_key =  openai_api_key,
            openai_api_base =  openai_api_base,
            openai_api_version =  openai_api_version,
            openai_api_type = openai_api_type
    )

    (chat_approaches, brainstorm_approaches, sum_approaches) = initApproaches(model_info=model_info, cfg=cfg["backend"], repoHelper=repoHelper)

    if cfg["backend"]["enable_database"]:
        repoHelper.setup_schema(base=Base)

    return  AppConfig(
        model_info=model_info,
        azure_credential=azure_credential,
        authentification_client=auth_helper,
        configuration_features=cfg,
        chat_approaches= chat_approaches,
        brainstorm_approaches= brainstorm_approaches,
        sum_approaches= sum_approaches,
        repository=repoHelper,
        backend_config=cfg["backend"]
    )
