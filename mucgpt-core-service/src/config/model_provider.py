import logging
from typing import Dict, List, Optional, Union

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
    def _create_configurable_fields() -> Dict[str, ConfigurableField]:
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
            "max_tokens": ConfigurableField(
                id="llm_max_tokens",
                name="LLM Max Tokens",
                description="The maximum number of tokens to generate in the output.",
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
        max_output_tokens: int,
        n: int,
        temperature: float,
        streaming: bool,
        logger: Optional[logging.Logger] = None,
    ) -> Union[AzureChatOpenAI, ChatOpenAI]:
        """Create a specific LLM instance based on model configuration.

        Args:
            model_config: Configuration for the model
            max_output_tokens: Maximum number of tokens in the output
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

        if max_output_tokens <= 0:
            raise ValueError(f"max_output_tokens must be positive, got {max_output_tokens}")

        try:
            if model_config.type == "AZURE":
                return AzureChatOpenAI(
                    deployment_name=model_config.deployment,
                    openai_api_key=model_config.api_key,
                    azure_endpoint=model_config.endpoint.unicode_string(),
                    openai_api_version=model_config.api_version,
                    max_tokens=max_output_tokens,
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
                    max_tokens=max_output_tokens,
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
            models: List[ModelsConfig],
            max_output_tokens: int,
            n: int = 1,
            temperature: float = 0.7,
            streaming: bool = False,
            logger: Optional[logging.Logger] = None,
    ):
        """
        Init model based on provided configuration.

        Args:
            models: List of model configurations
            max_output_tokens: Maximum number of tokens in the output
            n: Number of completions to generate (default: 1)
            temperature: Temperature for generation (default: 0.7)
            streaming: Whether to stream the response (default: False)
            logger: Logger instance for logging messages (optional)

        Returns:
            RunnableSerializable: The configured LLM

        Raises:
            ModelsConfigurationException: If no models are configured
        """
        # Use default logger if none provided
        _logger = logger or logging.getLogger(__name__)

        if not models:
            raise ModelsConfigurationException("No models found in the configuration.json")

        default_model = models[0]

        try:
            llm = ModelProvider._create_llm_instance(
                default_model, max_output_tokens, n, temperature, streaming, logger=_logger
            )
        except Exception as e:
            raise ModelsConfigurationException(
                f"Failed to initialize default model: {str(e)}"
            )

        # Add configurable fields to default model
        configurable_fields = ModelProvider._create_configurable_fields()
        llm = llm.configurable_fields(**configurable_fields)

        # Add alternative models
        alternatives: Dict[str, RunnableSerializable] = {
            "fake": FakeListLLM(responses=["Test response"])
        }

        for model in models[1:]:
            try:
                alternative = ModelProvider._create_llm_instance(
                    model, max_output_tokens, n, temperature, streaming, logger=_logger
                )
                # Add configurable fields to alternative model
                alternative = alternative.configurable_fields(**configurable_fields)
                alternatives[model.llm_name] = alternative
            except Exception as e:
                # Log the error but continue with other models
                _logger.warning(f"Failed to initialize model {model.llm_name}: {str(e)}")

        # Configure alternatives
        llm = llm.configurable_alternatives(
            ConfigurableField(id="llm"), default_key=default_model.llm_name, **alternatives
        )
        ModelProvider._llm = llm

    @staticmethod
    def get_model():
        """Returns a configured LLM that can be parametrized during runtime."""
        if ModelProvider._llm is None:
            raise "Model not initialized"
        return ModelProvider._llm
