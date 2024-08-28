import os
from typing import Tuple

from brainstorm.brainstorm import Brainstorm
from chat.chat import Chat
from core.authentification import AuthentificationHelper
from core.confighelper import ConfigHelper
from core.datahelper import Base, Repository
from core.llmhelper import getModel
from core.types.AppConfig import AppConfig
from core.types.Config import BackendConfig, DatabaseConfig
from summarize.summarize import Summarize


def initApproaches(cfg: BackendConfig, repoHelper: Repository) -> Tuple[Chat, Brainstorm, Summarize]:
    """init different approaches

    Args:
        cfg (BackendConfig): the config for the backend
        repoHelper (Repository): the repository to save request statistics

    Returns:
        Tuple[Chat, Brainstorm, Summarize]: the implementation behind chat, brainstorm and summarize
    """
    brainstormllm = getModel(
                    models=cfg["models"],
                    max_tokens =  4000,
                    n = 1,
                    streaming=False,
                    temperature=0.9)
    sumllm = getModel(
                    models=cfg["models"],
                    max_tokens =  2000,
                    n = 1,
                    streaming=False,
                    temperature=0)
    chatlllm = getModel(
                    models=cfg["models"],
                    max_tokens=4000,
                    n = 1,
                    streaming=True,
                    temperature=0.7)
    chat_approaches = Chat(llm=chatlllm, config=cfg["chat"], repo=repoHelper)
    brainstorm_approaches = Brainstorm(llm=brainstormllm,  config=cfg["brainstorm"], repo=repoHelper)
    sum_approaches =  Summarize(llm=sumllm, config=cfg["sum"], repo=repoHelper)
    return (chat_approaches, brainstorm_approaches, sum_approaches)

async def initApp() -> AppConfig:
    """inits the app

    Returns:
        AppConfig: contains the configuration for the webservice
    """
    # read enviornment config
    env_config = os.environ['MUCGPT_CONFIG'] if "MUCGPT_CONFIG" in os.environ else os.path.dirname(os.path.realpath(__file__))+"/config.json"
    base_config = os.environ['MUCGPT_BASE_CONFIG'] if "MUCGPT_BASE_CONFIG" in os.environ is not None else os.path.dirname(os.path.realpath(__file__))+"/base.json"
    config_helper = ConfigHelper(env_config=env_config, base_config=base_config)
    cfg = config_helper.loadData()
     # Set up authentication helper
    auth_helper = AuthentificationHelper(
        issuer=cfg["backend"]["sso_config"]["sso_issuer"],
        role=cfg["backend"]["sso_config"]["role"]
    )  
    # set up repositorty
    if(cfg["backend"]["enable_database"]):
        db_config: DatabaseConfig = cfg["backend"]["db_config"]
        repoHelper = Repository(
            username=db_config["db_user"],
            host=db_config["db_host"],
            database=db_config["db_name"],
            password=db_config["db_passwort"]
        )
        repoHelper.setup_schema(base=Base)
    else:
        repoHelper = None

    (chat_approaches, brainstorm_approaches, sum_approaches) = initApproaches(cfg=cfg["backend"], repoHelper=repoHelper)


        

    return  AppConfig(
        authentification_client=auth_helper,
        configuration_features=cfg,
        chat_approaches= chat_approaches,
        brainstorm_approaches= brainstorm_approaches,
        sum_approaches= sum_approaches,
        repository=repoHelper,
        backend_config=cfg["backend"]
    )
