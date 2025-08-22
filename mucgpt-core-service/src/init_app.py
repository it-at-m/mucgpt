import inspect
import json
import os
from typing import Any, Dict, Optional, Type, Union

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from config.model_provider import get_model
from config.settings import LangfuseSettings, Settings
from core.logtools import getLogger

logger = getLogger()


class ModelOptions:
    """Helper class for model initialization options."""

    def __init__(
        self,
        streaming: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        custom_model: Optional[Any] = None,
    ):
        """Initialize model options with validation.

        Args:
            streaming: Whether to enable streaming responses
            temperature: Model temperature (0-1)
            max_tokens: Maximum number of output tokens
            custom_model: Optional pre-configured model (for testing)
        """
        # Validate parameters
        if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 1:
            raise ValueError(f"Temperature must be between 0 and 1, got {temperature}")

        if not isinstance(max_tokens, int) or max_tokens <= 0:
            raise ValueError(f"Max tokens must be a positive integer, got {max_tokens}")

        self.streaming = streaming
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.custom_model = custom_model


def init_service(
    service_class: Type,
    cfg: Settings,
    options: Optional[Union[ModelOptions, Dict[str, Any]]] = None,
) -> Any:
    """Initialize a service with a configured model.

    Args:
        service_class: The service class to instantiate
        cfg: Backend configuration
        options: Model options as ModelOptions object or dict

    Returns:
        Initialized service instance

    Raises:
        TypeError: If the service_class is not a valid type
        Exception: For any other initialization errors
    """
    if not inspect.isclass(service_class):
        raise TypeError(f"Service class {service_class} is not a class")

    # Convert dict to ModelOptions if needed
    if isinstance(options, dict):
        options = ModelOptions(**options)
    # Use default options if none provided
    elif options is None:
        options = ModelOptions()

    try:
        if options.custom_model is None:
            logger.debug(
                "Initializing %s with model from config", service_class.__name__
            )
            model = get_model(
                models=cfg.MODELS,
                max_output_tokens=options.max_tokens,
                n=1,
                streaming=options.streaming,
                temperature=options.temperature,
                logger=logger,
            )
        else:
            logger.debug("Initializing %s with custom model", service_class.__name__)
            model = options.custom_model

        return service_class(llm=model)
    except Exception as e:
        logger.error("Failed to initialize %s: %s", service_class.__name__, e)
        raise


def init_agent(
    cfg: Settings,
    langfuse_cfg: LangfuseSettings,
    options: Optional[Union[ModelOptions, Dict[str, Any]]] = None,
) -> MUCGPTAgentExecutor:
    """Initialize a MUCGPTAgentExecutor with configuration.

    Args:
        cfg: Application settings
        langfuse_cfg: Langfuse configuration settings
        options: Model options as ModelOptions object or dict

    Returns:
        Configured MUCGPTAgentExecutor
    """
    return MUCGPTAgentExecutor(
        version=cfg.VERSION,
        agent=init_service(
            MUCGPTAgent,
            cfg=cfg,
            options=options,
        ),
        langfuse_cfg=langfuse_cfg,
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
