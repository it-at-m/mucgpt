import logging
from typing import Any

from langchain_openai import AzureChatOpenAI, ChatOpenAI

from config.settings import ModelsConfig


class ModelsConfigurationException(Exception):
    """Exception raised for errors in the model configuration."""

    pass


class ModelRegistry:
    """Registry containing all available models and their configurations."""

    _models: dict[str, ChatOpenAI | AzureChatOpenAI] = {}
    _default_model: ChatOpenAI | AzureChatOpenAI | None = None

    @staticmethod
    def init_chat_model(config: ModelsConfig) -> ChatOpenAI | AzureChatOpenAI:
        """Initialize a concrete chat model from configuration."""
        try:
            if config.type == "OPENAI":
                return ChatOpenAI(
                    default_headers={"extra-parameters": "drop"},
                    model=config.llm_name,
                    api_key=config.api_key,
                    base_url=config.endpoint.unicode_string(),
                    n=1,
                )
            if config.type == "AZURE":
                return AzureChatOpenAI(
                    azure_deployment=config.deployment,
                    model=config.llm_name,
                    api_key=config.api_key,
                    azure_endpoint=config.endpoint.unicode_string(),
                    api_version=config.api_version,
                    n=1,
                    openai_api_type="azure",
                )
            raise ModelsConfigurationException(
                f"Unknown model type: {config.type}. Currently only `AZURE` and `OPENAI` are supported."
            )
        except Exception as exc:
            if isinstance(exc, ModelsConfigurationException):
                raise
            raise ModelsConfigurationException(
                f"Failed to initialize chat model {config.llm_name}: {exc}"
            ) from exc

    @staticmethod
    def normalize_model_settings(
        model: ChatOpenAI | AzureChatOpenAI,
        settings: dict[str, Any],
    ) -> dict[str, Any]:
        """Remove request parameters the selected model explicitly rejects."""
        normalized = dict(settings)
        profile = getattr(model, "profile", None)
        model_name = getattr(model, "model_name", None)

        # NOTE: 
        # as of 08.2026 13 models introduced after 17.02.2026 have no model profile
        # until this is resolved, the model name is used to determine whether 
        # the temperature parameter should be removed from the request settings.
        # https://github.com/langchain-ai/langchainjs/issues/11313
        #
        # gpt-5 models do not support temperature anymore. the way to control the model output is via the reasoning effort parameter.
        # https://medium.com/@skomarovsky/migrating-from-gpt-4-to-gpt-5-2-why-your-code-will-break-and-how-to-fix-it-372e0a89d449
        if (profile and profile.get("temperature") is False) or (
            model_name and "gpt-5" in model_name
        ):
            normalized.pop("temperature", None)
        return normalized

    @classmethod
    def init_models(
        cls,
        models_config: list[ModelsConfig],
        logger: logging.Logger | None = None,
    ) -> None:
        """Initialize the model registry with a list of model configurations."""
        if not models_config:
            raise ModelsConfigurationException(
                "No models found in the configuration.json"
            )
        model_names = [config.llm_name for config in models_config]
        if len(model_names) != len(set(model_names)):
            raise ModelsConfigurationException("Model names must be unique")

        _logger = logger or logging.getLogger(__name__)

        default_config = models_config[0]
        try:
            default_model = cls.init_chat_model(default_config)
        except ModelsConfigurationException as exc:
            raise ModelsConfigurationException(
                f"Failed to initialize default model: {exc}"
            ) from exc

        models = {default_config.llm_name: default_model}
        for config in models_config[1:]:
            try:
                models[config.llm_name] = cls.init_chat_model(config)
            except ModelsConfigurationException as exc:
                _logger.warning(f"Failed to initialize model {config.llm_name}: {exc}")

        cls._models = models
        cls._default_model = default_model

    @classmethod
    def get_model(
        cls,
        model_name: str | None = None,
        logger: logging.Logger | None = None,
    ) -> ChatOpenAI | AzureChatOpenAI:
        """Return the default model or a concrete model selected by name."""
        if cls._default_model is None:
            raise ModelsConfigurationException("Model registry is not initialized")
        if model_name is None:
            return cls._default_model
        try:
            return cls._models[model_name]
        except KeyError as exc:
            raise ModelsConfigurationException(
                f"Model {model_name!r} not found in the registry"
            ) from exc
