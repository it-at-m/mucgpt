from typing import Tuple

from brainstorm.brainstorm import Brainstorm
from chat.chat import Chat
from core.authentification import AuthentificationHelper
from core.confighelper import ConfigHelper
from core.datahelper import Base, Repository
from core.llmhelper import getModel
from core.logtools import getLogger
from core.types.AppConfig import AppConfig
from core.types.Config import BackendConfig, DatabaseConfig
from simply.simply import Simply
from summarize.summarize import Summarize

logger = getLogger()


def initApproaches(cfg: BackendConfig, repoHelper: Repository) -> Tuple[Chat, Brainstorm, Summarize]:
    """init different approaches

    Args:
        cfg (BackendConfig): the config for the backend
        repoHelper (Repository): the repository to save request statistics

    Returns:
        Tuple[Chat, Brainstorm, Summarize]: the implementation behind chat, brainstorm and summarize
    """
    logger.info("Init approaches")
    logger.info("%s llms configured", len(cfg.models))
    for model in cfg.models:
        logger.info("Model: %s", model.llm_name)
    brainstormllm = getModel(
                    models=cfg.models,
                    max_output_tokens =  4000,
                    n = 1,
                    streaming=False,
                    temperature=0.9)
    sumllm = getModel(
                    models=cfg.models,
                    max_output_tokens =  2000,
                    n = 1,
                    streaming=False,
                    temperature=0)
    chatllm = getModel(
                    models=cfg.models,
                    max_output_tokens=4000,
                    n = 1,
                    streaming=True,
                    temperature=0.7)
    simplyllm = getModel(
                    models=cfg.models,
                    max_output_tokens=4000,
                    n = 1,
                    streaming=True,
                    temperature=0)
    chat_approaches = Chat(llm=chatllm, config=cfg.chat, repo=repoHelper)
    brainstorm_approaches = Brainstorm(llm=brainstormllm,  config=cfg.brainstorm, repo=repoHelper)
    sum_approaches =  Summarize(llm=sumllm, config=cfg.sum, repo=repoHelper)
    simply_approaches =  Simply(llm=simplyllm, config=cfg.simply, repo=repoHelper)
    return (chat_approaches, brainstorm_approaches, sum_approaches, simply_approaches)

def initApp() -> AppConfig:
    """inits the app

    Returns:
        AppConfig: contains the configuration for the webservice
    """
    logger.info("Init app")
    config_helper = ConfigHelper()
    cfg = config_helper.loadData()
     # Set up authentication helper
    logger.info("Authentification enabled?:  " + str(cfg.backend.enable_auth))
    auth_helper = AuthentificationHelper(
        issuer=cfg.backend.sso_config.sso_issuer,
        role=cfg.backend.sso_config.role
    )
    # set up repositorty
    if(cfg.backend.enable_database):
        logger.info("Setting up database connection: " + cfg.backend.db_config.db_host)
        db_config: DatabaseConfig = cfg.backend.db_config
        repoHelper = Repository(
            username=db_config.db_user,
            host=db_config.db_host,
            database=db_config.db_name,
            password=db_config.db_passwort
        )
        repoHelper.setup_schema(base=Base)
    else:
        logger.info("No database provided")
        repoHelper = None

    (chat_approaches, brainstorm_approaches, sum_approaches, simply_approaches) = initApproaches(cfg=cfg.backend, repoHelper=repoHelper)


    logger.info("finished init App")

    return  AppConfig(
        authentification_client=auth_helper,
        configuration_features=cfg,
        chat_approaches= chat_approaches,
        brainstorm_approaches= brainstorm_approaches,
        simply_approaches=simply_approaches,
        sum_approaches= sum_approaches,
        repository=repoHelper,
        backend_config=cfg.backend
    )
