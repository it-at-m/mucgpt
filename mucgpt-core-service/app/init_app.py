from typing import Any, Optional

from agent.agent import MUCGPTAgent
from agent.agent_executor import MUCGPTAgentExecutor
from agent.tools.tools import ToolCollection
from config.langfuse_provider import LangfuseProvider
from config.model_provider import ModelProvider
from config.settings import (
    Settings,
    enrich_model_metadata,
    get_langfuse_settings,
    get_settings,
)
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.logtools import getLogger

logger = getLogger()


class ModelOptions:
    """Helper class for model initialization options."""

    def __init__(
        self,
        streaming: bool = True,
        temperature: float = 0.7,
        custom_model: Optional[Any] = None,
    ):
        """Initialize model options with validation.

        Args:
            streaming: Whether to enable streaming responses
            temperature: Model temperature (0-1)
            custom_model: Optional pre-configured model (for testing)
        """
        # Validate parameters
        if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 1:
            raise ValueError(f"Temperature must be between 0 and 1, got {temperature}")

        self.streaming = streaming
        self.temperature = temperature
        self.custom_model = custom_model


async def warmup_app():
    logger.info("Warming up app context...")
    settings = get_settings()
    # init model metadata
    _initialize_models_metadata(settings)
    # init model
    options = ModelOptions()
    ModelProvider.init_model(
        models=settings.MODELS,
        n=1,
        streaming=options.streaming,
        temperature=options.temperature,
        logger=logger,
    )
    # init langfuse
    langfuse_settings = get_langfuse_settings()
    LangfuseProvider.init(version=settings.VERSION, langfuse_cfg=langfuse_settings)
    # init redis
    await RedisCache.init_redis()
    logger.info("App context warmed up")


async def destroy_app():
    logger.info("Cleaning up app context...")
    # close redis
    try:
        redis = await RedisCache.get_redis()
        await redis.aclose()
    except RuntimeError:
        pass


def _initialize_models_metadata(cfg: Settings) -> None:
    """Ensure all configured models have complete metadata before use."""

    for model in cfg.MODELS:
        try:
            enrich_model_metadata(model)
        except ValueError as exc:
            logger.error(
                "Unable to prepare model %s for %s: %s",
                getattr(model, "llm_name", "<unknown>"),
                cfg.ENV_NAME,
                exc,
            )
            raise


async def init_agent(user_info: AuthenticationResult) -> MUCGPTAgentExecutor:
    """Initialize a MUCGPTAgentExecutor with configuration.

    Args:
        cfg: Backend configuration
        user_info: The user to create the Agent for

    Returns:
        Configured MUCGPTAgentExecutor
    """
    try:
        model = ModelProvider.get_model()
        tool_collection = ToolCollection(model=model)
        tools = await tool_collection.get_tools(user_info=user_info)
        agent = MUCGPTAgent(llm=model, tools=tools, tool_collection=tool_collection)
    except Exception as e:
        logger.error("Failed to initialize MUCGPTAgent: %s", e)
        raise
    return MUCGPTAgentExecutor(agent=agent)
