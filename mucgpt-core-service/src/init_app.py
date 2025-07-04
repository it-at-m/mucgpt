import json
import os
from typing import Tuple

from brainstorm.brainstorm import Brainstorm
from chat.chat import Chat
from config.settings import BackendConfig, Settings, get_settings
from core.llmhelper import getModel
from core.logtools import getLogger
from simply.simply import Simply
from summarize.summarize import Summarize

logger = getLogger()


def initServices(cfg: BackendConfig) -> Tuple[Chat, Brainstorm, Summarize]:
    """init different approaches

    Args:
        cfg (BackendConfig): the config for the backend

    Returns:
        Tuple[Chat, Brainstorm, Summarize]: the implementation behind chat, brainstorm and summarize
    """
    logger.info("Init approaches")
    logger.info("%s llms configured", len(cfg.models))
    for model in cfg.models:
        logger.info("Model: %s", model.llm_name)
    brainstormllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=False, temperature=0.9
    )
    sumllm = getModel(
        models=cfg.models, max_output_tokens=2000, n=1, streaming=False, temperature=0
    )
    chatllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=True, temperature=0.7
    )
    simplyllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=True, temperature=0
    )
    chat_service = Chat(llm=chatllm)
    brainstorm_service = Brainstorm(llm=brainstormllm)
    sum_service = Summarize(llm=sumllm)
    simply_service = Simply(llm=simplyllm)
    return (chat_service, brainstorm_service, sum_service, simply_service)


def initDepartments() -> list:
    """init departments from the json file
    Returns:
        list: the departments
    """

    departments_path = os.path.join(os.path.dirname(__file__), "departements.json")
    try:
        with open(departments_path, encoding="utf-8") as f:
            data = json.load(f)
            departments = data.get("departements", [])
        logger.info("Loaded %d departments from departements.json", len(departments))
    except Exception as e:
        logger.error("Failed to load departements.json: %s", e)
        departments = []
    return departments


def initApp() -> Tuple[Chat, Brainstorm, Summarize, Simply, Settings, list]:
    """init the app with all services and settings
    Returns:
        Tuple[Chat, Brainstorm, Summarize, Simply, Settings, list]: the services and settings
    """
    logger.info("Init app")
    settings = get_settings()
    (chat_service, brainstorm_service, sum_service, simply_service) = initServices(
        cfg=settings.backend
    )

    logger.info("finished init App")
    return (
        chat_service,
        brainstorm_service,
        sum_service,
        simply_service,
        settings,
        initDepartments(),
    )
