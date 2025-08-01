import json
import os
from typing import Any, Optional, Type

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from config.model_provider import get_model
from config.settings import BackendConfig, Settings
from core.logtools import getLogger
from simply.simply import Simply
from summarize.summarize import Summarize

logger = getLogger()


def init_service(
    service_class: Type,
    cfg: BackendConfig,
    streaming: bool = True,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    custom_model: Optional[Any] = None,
) -> Any:
    """Initialize a service with a configured model.

    Args:
        service_class: The service class to instantiate
        cfg: Backend configuration
        streaming: Whether to enable streaming
        temperature: Model temperature
        max_tokens: Maximum output tokens
        custom_model: Optional pre-configured model for testing

    Returns:
        Initialized service instance

    Raises:
        ValueError: If the temperature is outside the valid range
        TypeError: If the service_class is not a valid type
        Exception: For any other initialization errors
    """
    # Basic validation
    if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 1:
        raise ValueError(f"Temperature must be between 0 and 1, got {temperature}")

    if not isinstance(max_tokens, int) or max_tokens <= 0:
        raise ValueError(f"Max tokens must be a positive integer, got {max_tokens}")

    if not callable(getattr(service_class, "__call__", None)):
        raise TypeError(f"Service class {service_class} is not callable")

    try:
        if custom_model is None:
            logger.debug(
                "Initializing %s with model from config", service_class.__name__
            )
            model = get_model(
                models=cfg.models,
                max_output_tokens=max_tokens,
                n=1,
                streaming=streaming,
                temperature=temperature,
                logger=logger,
            )
        else:
            logger.debug("Initializing %s with custom model", service_class.__name__)
            model = custom_model

        return service_class(llm=model)
    except Exception as e:
        logger.error("Failed to initialize %s: %s", service_class.__name__, e)
        raise


def init_agent(cfg: Settings, custom_model=None) -> MUCGPTAgentExecutor:
    return MUCGPTAgentExecutor(
        agent=init_service(
            MUCGPTAgent,
            cfg.backend,
            streaming=True,
            temperature=0.7,
            max_tokens=4000,
            custom_model=custom_model,
        ),
        settings=cfg,
    )


def init_summarize_service(cfg: BackendConfig, custom_model=None) -> Summarize:
    return init_service(
        Summarize,
        cfg,
        streaming=False,
        temperature=0,
        max_tokens=2000,
        custom_model=custom_model,
    )


def init_simply_service(cfg: BackendConfig, custom_model=None) -> Simply:
    return init_service(
        Simply,
        cfg,
        streaming=True,
        temperature=0,
        max_tokens=4000,
        custom_model=custom_model,
    )


def init_departments() -> list:
    """Initialize departments from the json file.

    Returns:
        list: The departments
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
