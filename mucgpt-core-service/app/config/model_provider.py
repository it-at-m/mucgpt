import logging

from langchain_community.llms.fake import FakeListLLM
from langchain_core.runnables import ConfigurableField
from langchain_core.runnables.base import RunnableSerializable
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from config.settings import ModelsConfig


class ModelsConfigurationException(Exception):
    """Exception raised for errors in the model configuration."""

    pass


class ModelProvider:
    _llm = None

    @staticmethod
    def _create_configurable_fields() -> dict[str, ConfigurableField]:
        """Create common configurable fields for LLM models.

        Returns:
            Dict[str, ConfigurableField]: Dictionary of configurable fields for LLM models
        """
        return {
            "temperature": ConfigurableField(
                id="llm_temperature",
                name="LLM Temperature",
                description="The temperature of the LLM (0.0-1.0). Higher values make output more random, lower values more deterministic.",
            ),
            "streaming": ConfigurableField(
                id="llm_streaming",
                name="Streaming",
                description="Whether to stream the LLM response as it's being generated.",
            ),
            "callbacks": ConfigurableField(
                id="llm_callbacks",
                name="Callbacks",
                description="Callback handlers for the LLM execution pipeline.",
            ),
        }

    @staticmethod
    def _create_llm_instance(
        model_config: ModelsConfig,
        n: int,
        temperature: float,
        streaming: bool,
        logger: logging.Logger | None = None,
    ) -> AzureChatOpenAI | ChatOpenAI:
        """Create a specific LLM instance based on model configuration.

        Args:
            model_config: Configuration for the model
            n: Number of completions to generate
            temperature: Temperature for generation
            streaming: Whether to stream the response
            logger: Logger instance for logging messages (optional)

        Returns:
            Union[AzureChatOpenAI, ChatOpenAI]: The configured LLM instance

        Raises:
            ModelsConfigurationException: If the model type is unsupported
        """
        # Use default logger if none provided
        _logger = logger or logging.getLogger(__name__)

        # Validate parameters
        if temperature < 0.0 or temperature > 1.0:
            _logger.warning(
                f"Temperature value {temperature} is outside recommended range [0.0-1.0]"
            )
        try:
            if model_config.type == "AZURE":
                return AzureChatOpenAI(
                    deployment_name=model_config.deployment,
                    openai_api_key=model_config.api_key,
                    azure_endpoint=model_config.endpoint.unicode_string(),
                    openai_api_version=model_config.api_version,
                    n=n,
                    streaming=streaming,
                    temperature=temperature,
                    openai_api_type="azure",
                )
            elif model_config.type == "OPENAI":
                return ChatOpenAI(
                    default_headers={"extra-parameters": "drop"},
                    model=model_config.llm_name,
                    api_key=model_config.api_key,
                    openai_api_base=model_config.endpoint.unicode_string(),
                    n=n,
                    streaming=streaming,
                    temperature=temperature,
                )
            else:
                raise ModelsConfigurationException(
                    f"Unknown model type: {model_config.type}. Currently only `AZURE` and `OPENAI` are supported."
                )
        except Exception as e:
            _logger.error(
                f"Error creating LLM instance for {model_config.llm_name}: {str(e)}"
            )
            raise

    @staticmethod
    def init_model(
        models: list[ModelsConfig],
        n: int = 1,
        temperature: float = 0.7,
        streaming: bool = False,
        logger: logging.Logger | None = None,
    ) -> None:
        """
        Init model based on provided configuration.

        Args:
            models: List of model configurations
            n: Number of completions to generate (default: 1)
            temperature: Temperature for generation (default: 0.7)
            streaming: Whether to stream the response (default: False)
            logger: Logger instance for logging messages (optional)

        Raises:
            ModelsConfigurationException: If no models are configured
        """
        # Use default logger if none provided
        _logger = logger or logging.getLogger(__name__)

        if not models:
            raise ModelsConfigurationException(
                "No models found in the configuration.json"
            )

        default_model = models[0]

        try:
            llm = ModelProvider._create_llm_instance(
                default_model, n, temperature, streaming, logger=_logger
            )
        except Exception as e:
            raise ModelsConfigurationException(
                f"Failed to initialize default model: {str(e)}"
            ) from e

        # Add configurable fields to default model
        configurable_fields = ModelProvider._create_configurable_fields()
        llm = llm.configurable_fields(**configurable_fields)

        # Add alternative models
        alternatives: dict[str, RunnableSerializable] = {
            "fake": FakeListLLM(responses=["Test response"])
        }

        for model in models[1:]:
            try:
                alternative = ModelProvider._create_llm_instance(
                    model, n, temperature, streaming, logger=_logger
                )
                # Add configurable fields to alternative model
                alternative = alternative.configurable_fields(**configurable_fields)
                alternatives[model.llm_name] = alternative
            except Exception as e:
                # Log the error but continue with other models
                _logger.warning(
                    f"Failed to initialize model {model.llm_name}: {str(e)}"
                )

        # Configure alternatives
        llm = llm.configurable_alternatives(
            ConfigurableField(id="llm"),
            default_key=default_model.llm_name,
            **alternatives,
        )
        ModelProvider._llm = llm

    @staticmethod
    def get_model():
        """Returns a configured LLM that can be parametrized during runtime."""
        if ModelProvider._llm is None:
            raise RuntimeError("Model not initialized")
        return ModelProvider._llm


class ModelRegistry:
    """Registry containing all available models and their configurations."""

    _models: dict[str, ChatOpenAI | AzureChatOpenAI]
    _dafault_model: ChatOpenAI | AzureChatOpenAI

    @staticmethod
    def init_chat_model(name: ModelsConfig) -> ChatOpenAI | AzureChatOpenAI:
        """initialize a chat model based on the provided configuration."""
        if "ki-proxy" in name.endpoint.encoded_string().strip().lower():
            try:
                return ChatOpenAI(
                    model=name.llm_name,
                    api_key=name.api_key,
                    base_url=name.endpoint.unicode_string(),
                    n=1,
                    streaming=False,
                    temperature=0.7,
                )
            except Exception as e:
                raise ModelsConfigurationException(
                    f"Failed to initialize chat model {name.llm_name}: {str(e)}"
                ) from e
        else: 
            try:
                return AzureChatOpenAI(
                    name=name.deployment,
                    api_key=name.api_key,
                    azure_endpoint=name.endpoint.unicode_string(),
                    api_version=name.api_version,
                    n=1,
                    streaming=False,
                    temperature=0.7,
                    openai_api_type="azure",
                )
            except Exception as e:
                raise ModelsConfigurationException(
                    f"Failed to initialize chat model {name.llm_name}: {str(e)}"
                ) from e

    @classmethod
    def init_models(cls, models_config: list[ModelsConfig], logger: logging.Logger | None = None) -> None:
        """Initialize the model registry with a list of model configurations."""
        if not models_config:
            raise ModelsConfigurationException(
                "No models found in the configuration.json"
            )
        cls._models = {config.llm_name: ModelRegistry.init_chat_model(config) for config in models_config}
        cls._dafault_model = ModelRegistry.init_chat_model(models_config[0])

    @classmethod
    def get_model(cls, model_name: str | None = None, logger: logging.Logger | None = None,) -> ChatOpenAI | AzureChatOpenAI:
        """Get the model configuration for a given model name."""
        logger = logger or logging.getLogger(__name__)
        if not model_name or model_name not in cls._models:
            if not model_name:
                logger.warning(f"No model name provided, defaulting to {cls._dafault_model.name}")
            else:
                logger.warning(f"Model {model_name} not found in the registry, defaulting to {cls._dafault_model.name}")
            return cls._dafault_model
        return cls._models[model_name]