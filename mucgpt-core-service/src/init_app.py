import json
import os
from typing import Any, Optional

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from agent.tools.tools import ToolCollection
from config.model_provider import ModelProvider
from core.auth_models import AuthenticationResult
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


async def init_agent(
        user_info: AuthenticationResult
) -> MUCGPTAgentExecutor:
    """Initialize a MUCGPTAgentExecutor with configuration.

    Args:
        user_info: The user to create the Agent for

    Returns:
        Configured MUCGPTAgentExecutor
    """
    options = ModelOptions()

    try:
        if options.custom_model is None:
            logger.debug("Initializing agent with model from config")
            model = ModelProvider.get_model()
        else:
            logger.debug("Initializing agent with custom model")
            model = options.custom_model

        tool_collection = ToolCollection(model=model)
        tools = await tool_collection.get_tools(user_info=user_info)
        agent = MUCGPTAgent(llm=model, tools=tools, tool_collection=tool_collection)
    except Exception as e:
        logger.error("Failed to initialize MUCGPTAgent: %s", e)
        raise
    return MUCGPTAgentExecutor(agent=agent)


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
