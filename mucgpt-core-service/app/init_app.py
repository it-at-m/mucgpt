from typing import Any

from anyio import CancelScope

from agent.agent_executor import MUCGPTAgentExecutor
from agent.deep_agent import MUCGPTAgent
from agent.tools.approval import requires_approval
from agent.tools.tools import ToolCollection
from config.harness_profiles import register_model_harness_profile
from config.langfuse_provider import LangfuseProvider
from config.model_provider import ModelRegistry
from config.settings import (
    Settings,
    enrich_model_metadata,
    get_settings,
)
from core.auth_models import AuthenticationResult
from core.cache import RedisCache
from core.document_service import SelectedDocument
from core.image_store import ImageStorageManager
from core.lf_prompts import PromptPool
from core.logtools import getLogger
from core.persistance_helpers import PersistanceHelpers
from core.virtual_file_system_helper import (
    FileStoreManager,
    create_backend,
    create_permissions,
)
from database.document_catalog import DocumentCatalogManager
from database.image_catalog import ImageCatalogManager

logger = getLogger()


class ModelOptions:
    """Helper class for model initialization options."""

    def __init__(
        self,
        streaming: bool = True,
        temperature: float = 0.7,
        custom_model: Any | None = None,
    ):
        """Initialize model options with validation.

        Args:
            streaming: Whether to enable streaming responses
            temperature: Model temperature (0-1)
            custom_model: Optional pre-configured model (for testing)
        """
        # Validate parameters
        if not isinstance(temperature, int | float) or not 0 <= temperature <= 1:
            raise ValueError(f"Temperature must be between 0 and 1, got {temperature}")

        self.streaming = streaming
        self.temperature = temperature
        self.custom_model = custom_model


async def warmup_app() -> None:
    logger.info("Warming up app context...")
    settings = get_settings()
    # init model metadata
    _initialize_models_metadata(settings)
    # init model
    ModelRegistry.init_models(
        models_config=settings.models,
        logger=logger,
        fallback_reasoning_effort=settings.fallback_reasoning_effort,
    )
    # Register model-specific Deep Agents harness profiles.
    for model_config in settings.models:
        register_model_harness_profile(model_config)
    # init langfuse (credentials come from the standard LANGFUSE_* env vars)
    lf_client = LangfuseProvider.init(version=settings.version)
    PromptPool.init(lf_client, settings.prompts)
    # init redis
    await RedisCache.init_redis()

    # Independent PostgreSQL resources for conversation state and documents.
    try:
        await PersistanceHelpers.init(settings)
        await FileStoreManager.init(settings)
        await DocumentCatalogManager.init(settings)
        # Image catalog always initializes; the store only when image input
        # is enabled (disabled configs publish nothing and reject uploads).
        await ImageCatalogManager.init(settings)
        await ImageStorageManager.init(settings.image_input)
    except BaseException:
        with CancelScope(shield=True):
            await destroy_app()
        raise
    logger.info("App context warmed up")


async def destroy_app() -> None:
    logger.info("Cleaning up app context...")
    # close redis
    try:
        redis = await RedisCache.get_redis()
        await redis.aclose()
    except RuntimeError:
        pass
    except Exception:
        logger.exception("Failed to close RedisCache")

    try:
        await ImageStorageManager.close()
        await ImageCatalogManager.close()
    except Exception:
        logger.exception("Failed to close image resources")

    try:
        await DocumentCatalogManager.close()
    except Exception:
        logger.exception("Failed to close DocumentCatalogManager")

    # close document store independently of conversation persistence
    try:
        await FileStoreManager.close()
    except Exception:
        logger.exception("Failed to close FileStoreManager")

    # close postgres connection
    try:
        await PersistanceHelpers.close()
    except Exception:
        logger.exception("Failed to close PersistanceHelpers")


def _initialize_models_metadata(cfg: Settings) -> None:
    """Ensure all configured models have complete metadata before use."""

    for model in cfg.models:
        try:
            enrich_model_metadata(model)
        except ValueError as exc:
            logger.error(
                "Unable to prepare model %s for %s: %s",
                getattr(model, "id", "<unknown>"),
                cfg.env_name,
                exc,
            )
            raise


async def init_agent(
    user_info: AuthenticationResult,
    model_name: str | None = None,
    persist: bool = True,
    document_selection: list[SelectedDocument] | None = None,
) -> MUCGPTAgentExecutor:
    """Initialize a MUCGPTAgentExecutor with configuration.

    Args:
        user_info: The user to create the Agent for
        model_name: The model to run the agent with (default model if None)
        persist: Attach the checkpointer; False builds a stateless agent
        document_selection: Server-resolved documents authorized for this run

    Returns:
        Configured MUCGPTAgentExecutor
    """
    try:
        model = ModelRegistry.get_model(model_name)
        tool_collection = ToolCollection(model=model)
        selected_document_ids = [doc.id for doc in document_selection or []]
        backend = create_backend(
            user_id=user_info.user_id,
            selected_document_ids=selected_document_ids,
        )
        document_permissions = create_permissions(
            selected_document_ids=selected_document_ids
        )
        tools = await tool_collection.get_tools(
            user_info=user_info
        )  # all tools that are available
        checkpointer = (
            PersistanceHelpers.get_checkpointer_if_ready() if persist else None
        )
        if not checkpointer:
            tools = [tool for tool in tools if not requires_approval(tool)]
        logger.debug(
            f"Initializing MUCGPTAgent with tools: {[tool.name for tool in tools]}"
        )
        agent = MUCGPTAgent(
            llm=model,
            tools=tools,
            debug=False,
            backend=backend,
            permissions=document_permissions,
            document_selection=document_selection,
            checkpointer=checkpointer,
        )
    except Exception as e:
        logger.error("Failed to initialize MUCGPTAgent: %s", e)
        raise
    return MUCGPTAgentExecutor(agent=agent)
