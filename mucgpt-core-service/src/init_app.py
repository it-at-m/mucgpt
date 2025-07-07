import json
import os

from brainstorm.brainstorm import Brainstorm
from chat.chat import Chat
from config.llmhelper import getModel
from config.settings import BackendConfig
from core.logtools import getLogger
from simply.simply import Simply
from summarize.summarize import Summarize

logger = getLogger()


def initChatService(cfg: BackendConfig) -> Chat:
    """Initialize the Chat service."""
    chatllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=True, temperature=0.7
    )
    return Chat(llm=chatllm)


def initBrainstormService(cfg: BackendConfig) -> Brainstorm:
    """Initialize the Brainstorm service."""
    brainstormllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=False, temperature=0.9
    )
    return Brainstorm(llm=brainstormllm)


def initSummarizeService(cfg: BackendConfig) -> Summarize:
    """Initialize the Summarize service."""
    sumllm = getModel(
        models=cfg.models, max_output_tokens=2000, n=1, streaming=False, temperature=0
    )
    return Summarize(llm=sumllm)


def initSimplyService(cfg: BackendConfig) -> Simply:
    """Initialize the Simply service."""
    simplyllm = getModel(
        models=cfg.models, max_output_tokens=4000, n=1, streaming=True, temperature=0
    )
    return Simply(llm=simplyllm)


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
