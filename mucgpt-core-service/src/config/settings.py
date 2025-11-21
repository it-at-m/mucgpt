import logging
from functools import lru_cache
from typing import Any, List
from urllib.parse import urljoin

import httpx
from pydantic import (
    BaseModel,
    Field,
    HttpUrl,
    PositiveInt,
    SecretStr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

MODEL_INFO_TIMEOUT_SECONDS = 8.0
_logger = logging.getLogger(__name__)
_positive_int_adapter = TypeAdapter(PositiveInt)
_float_adapter = TypeAdapter(float)


class ModelInfo(BaseModel):
    auto_enrich_from_model_info_endpoint: bool = True
    max_output_tokens: PositiveInt | None = None
    max_input_tokens: PositiveInt | None = None
    description: str | None = None
    input_cost_per_token: float | None = None
    output_cost_per_token: float | None = None
    supports_function_calling: bool | None = None
    supports_reasoning: bool | None = None
    supports_vision: bool | None = None
    litellm_provider: str | None = None
    inference_location: str | None = None


class ModelsConfig(BaseModel):
    type: str = Field(..., min_length=1)
    llm_name: str = Field(..., min_length=1)
    deployment: str = ""
    endpoint: HttpUrl
    api_key: SecretStr
    api_version: str = ""
    model_info: ModelInfo = Field(default_factory=ModelInfo)

    @field_validator("api_key", mode="before")
    def parse_secret(cls, value):
        if isinstance(value, str):
            return SecretStr(value)
        return value

    @model_validator(mode="before")
    def bundle_model_info(cls, data):
        if not isinstance(data, dict):
            return data

        info_fields = {
            "auto_enrich_from_model_info_endpoint",
            "auto_enrich",
            "max_output_tokens",
            "max_input_tokens",
            "description",
            "input_cost_per_token",
            "output_cost_per_token",
            "supports_function_calling",
            "supports_reasoning",
            "supports_vision",
            "litellm_provider",
            "inference_location",
        }

        existing_info = data.get("model_info")
        if isinstance(existing_info, ModelInfo):
            info_payload: dict[str, Any] = existing_info.model_dump()
        elif isinstance(existing_info, dict):
            info_payload = dict(existing_info)
        else:
            info_payload = {}

        for field in info_fields:
            if field in data:
                info_payload.setdefault(field, data.pop(field))

        if (
            "auto_enrich_from_model_info_endpoint" not in info_payload
            and "auto_enrich" in info_payload
        ):
            info_payload["auto_enrich_from_model_info_endpoint"] = info_payload.pop(
                "auto_enrich"
            )

        data["model_info"] = info_payload
        return data

    @model_validator(mode="after")
    def ensure_model_metadata(cls, model: "ModelsConfig") -> "ModelsConfig":
        """Ensure model metadata is fully populated."""

        info = model.model_info
        info.description = (info.description or "").strip() or None

        if _has_complete_metadata(info):
            return model

        if not info.auto_enrich_from_model_info_endpoint:
            missing_fields = _missing_metadata_fields(info)
            raise ValueError(
                "Model metadata incomplete and auto_enrich_from_model_info_endpoint disabled: "
                + ", ".join(sorted(missing_fields))
            )

        try:
            entry = _fetch_remote_model_entry(model)
        except RuntimeError as exc:  # pragma: no cover - defended via unit tests
            raise ValueError(
                "Unable to enrich model configuration. Provide max_input_tokens, "
                "max_output_tokens, and description directly or ensure the model info "
                f"endpoint at {model.endpoint} is reachable."
            ) from exc

        if entry is None:
            raise ValueError(
                f"Model {model.llm_name} not found in info endpoint at {model.endpoint}. "
                "Provide the missing metadata directly."
            )

        _apply_model_info(model, entry)

        missing_fields = _missing_metadata_fields(info)
        if missing_fields:
            raise ValueError(
                "Model metadata incomplete after enrichment: "
                + ", ".join(sorted(missing_fields))
            )

        info.description = (info.description or "").strip() or None
        return model

    @property
    def max_output_tokens(self) -> PositiveInt | None:
        return self.model_info.max_output_tokens

    @max_output_tokens.setter
    def max_output_tokens(self, value: PositiveInt | None) -> None:
        self.model_info.max_output_tokens = value

    @property
    def max_input_tokens(self) -> PositiveInt | None:
        return self.model_info.max_input_tokens

    @max_input_tokens.setter
    def max_input_tokens(self, value: PositiveInt | None) -> None:
        self.model_info.max_input_tokens = value

    @property
    def description(self) -> str | None:
        return self.model_info.description

    @description.setter
    def description(self, value: str | None) -> None:
        self.model_info.description = (value or "").strip() or None

    @property
    def input_cost_per_token(self) -> float | None:
        return self.model_info.input_cost_per_token

    @input_cost_per_token.setter
    def input_cost_per_token(self, value: float | None) -> None:
        self.model_info.input_cost_per_token = value

    @property
    def output_cost_per_token(self) -> float | None:
        return self.model_info.output_cost_per_token

    @output_cost_per_token.setter
    def output_cost_per_token(self, value: float | None) -> None:
        self.model_info.output_cost_per_token = value

    @property
    def supports_function_calling(self) -> bool | None:
        return self.model_info.supports_function_calling

    @supports_function_calling.setter
    def supports_function_calling(self, value: bool | None) -> None:
        self.model_info.supports_function_calling = value

    @property
    def supports_reasoning(self) -> bool | None:
        return self.model_info.supports_reasoning

    @supports_reasoning.setter
    def supports_reasoning(self, value: bool | None) -> None:
        self.model_info.supports_reasoning = value

    @property
    def supports_vision(self) -> bool | None:
        return self.model_info.supports_vision

    @supports_vision.setter
    def supports_vision(self, value: bool | None) -> None:
        self.model_info.supports_vision = value

    @property
    def litellm_provider(self) -> str | None:
        return self.model_info.litellm_provider

    @litellm_provider.setter
    def litellm_provider(self, value: str | None) -> None:
        self.model_info.litellm_provider = value

    @property
    def inference_location(self) -> str | None:
        return self.model_info.inference_location

    @inference_location.setter
    def inference_location(self, value: str | None) -> None:
        self.model_info.inference_location = value


class SSOSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_SSO_",
        extra="ignore",
    )
    ROLE: str = "lhm-ab-mucgpt-user"


class LangfuseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_LANGFUSE_",
        extra="ignore",
        case_sensitive=False,
    )
    PUBLIC_KEY: str | None = None
    SECRET_KEY: str | None = None
    HOST: str | None = None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_CORE_",
        extra="ignore",
        case_sensitive=False,
    )
    # General settings
    VERSION: str = Field(default="")
    LOG_CONFIG: str = "logconf.yaml"

    # Frontend settings
    ENV_NAME: str = "MUCGPT"
    ALTERNATIVE_LOGO: bool = False
    FRONTEND_VERSION: str = "unknown"
    ASSISTANT_VERSION: str = "unknown"

    # Backend settings
    UNAUTHORIZED_USER_REDIRECT_URL: str = ""
    MODELS: List[ModelsConfig] = []


def _has_complete_metadata(model_info: ModelInfo) -> bool:
    return (
        model_info.max_output_tokens is not None
        and model_info.max_input_tokens is not None
        and bool((model_info.description or "").strip())
    )


def _missing_metadata_fields(model_info: ModelInfo) -> List[str]:
    missing = []
    if model_info.max_output_tokens is None:
        missing.append("max_output_tokens")
    if model_info.max_input_tokens is None:
        missing.append("max_input_tokens")
    if not (model_info.description or "").strip():
        missing.append("description")
    return missing


def _apply_model_info(model: ModelsConfig, entry: dict[str, Any]) -> None:
    model_info = entry.get("model_info") or {}
    litellm_params = entry.get("litellm_params") or {}
    info = model.model_info

    if info.max_output_tokens is None:
        info.max_output_tokens = _coerce_positive_int(
            model_info.get("max_output_tokens") or model_info.get("max_tokens")
        )

    if info.max_input_tokens is None:
        info.max_input_tokens = _coerce_positive_int(
            model_info.get("max_input_tokens") or model_info.get("max_tokens")
        )

    if info.input_cost_per_token is None:
        info.input_cost_per_token = _coerce_float(
            _first_non_null(
                model_info.get("input_cost_per_token"),
                litellm_params.get("input_cost_per_token"),
            )
        )

    if info.output_cost_per_token is None:
        info.output_cost_per_token = _coerce_float(
            _first_non_null(
                model_info.get("output_cost_per_token"),
                litellm_params.get("output_cost_per_token"),
            )
        )

    if info.supports_function_calling is None:
        info.supports_function_calling = _coerce_bool(
            model_info.get("supports_function_calling")
        )

    if info.supports_reasoning is None:
        info.supports_reasoning = _coerce_bool(model_info.get("supports_reasoning"))

    if info.supports_vision is None:
        info.supports_vision = _coerce_bool(model_info.get("supports_vision"))

    if info.litellm_provider is None:
        info.litellm_provider = _first_non_null(
            model_info.get("litellm_provider"),
            entry.get("litellm_provider"),
        )

    if info.inference_location is None:
        info.inference_location = model_info.get("inference_location")

    if not (info.description or "").strip():
        info.description = _build_description(entry, model.llm_name)


def _coerce_positive_int(value: Any) -> PositiveInt | None:
    if value is None:
        return None
    try:
        return _positive_int_adapter.validate_python(value)
    except Exception:  # pragma: no cover - defensive
        _logger.debug("Invalid positive int received from model info: %s", value)
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return _float_adapter.validate_python(value)
    except Exception:  # pragma: no cover - defensive
        _logger.debug("Invalid float received from model info: %s", value)
        return None


def _coerce_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            return True
        if lowered in {"false", "0", "no", "n"}:
            return False
        return None
    if isinstance(value, (int, float)):
        return bool(value)
    return None


def _first_non_null(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def _build_description(entry: dict[str, Any], fallback_name: str) -> str:
    model_info = entry.get("model_info") or {}

    description = (
        model_info.get("description")
        or entry.get("description")
        or entry.get("model_name")
        or fallback_name
    )

    parts: List[str] = []
    base_model = model_info.get("base_model")
    version = model_info.get("version")
    inference_location = model_info.get("inference_location")

    if base_model:
        parts.append(str(base_model))
    if version:
        parts.append(f"version {version}")
    if inference_location:
        parts.append(f"location {inference_location}")

    if parts:
        description = f"{description} ({', '.join(parts)})"

    return description


def _fetch_remote_model_entry(model: ModelsConfig) -> dict[str, Any] | None:
    info_payload = _load_model_info(model.endpoint, model.api_key)
    return _match_model_entry(info_payload, model)


def _load_model_info(
    endpoint: HttpUrl, api_key: SecretStr | None
) -> List[dict[str, Any]]:
    info_url = urljoin(endpoint.unicode_string(), "model/info")

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key.get_secret_value()}"

    try:
        with httpx.Client(timeout=MODEL_INFO_TIMEOUT_SECONDS) as client:
            response = client.get(info_url, headers=headers)
            response.raise_for_status()
    except httpx.TimeoutException as exc:  # pragma: no cover - network
        raise RuntimeError(f"Request to {info_url} timed out") from exc
    except httpx.HTTPStatusError as exc:  # pragma: no cover - network
        raise RuntimeError(
            f"Info endpoint {info_url} returned {exc.response.status_code}"
        ) from exc
    except httpx.RequestError as exc:  # pragma: no cover - network
        raise RuntimeError(f"Failed to call {info_url}: {exc}") from exc

    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise RuntimeError(f"Unexpected payload from {info_url}: missing 'data' list")
    return payload["data"]


def _match_model_entry(
    payload: List[dict[str, Any]], model: ModelsConfig
) -> dict[str, Any] | None:
    desired_names = {
        name.lower()
        for name in [model.llm_name, model.deployment]
        if isinstance(name, str) and name
    }

    def _candidates(entry: dict[str, Any]) -> List[str]:
        model_info = entry.get("model_info") or {}
        litellm_params = entry.get("litellm_params") or {}
        names = [
            entry.get("model_name"),
            model_info.get("key"),
            model_info.get("base_model"),
            litellm_params.get("model"),
        ]
        return [name.lower() for name in names if isinstance(name, str) and name]

    for entry in payload:
        entry_names = _candidates(entry)
        for desired in desired_names:
            for candidate in entry_names:
                if desired == candidate or desired in candidate or candidate in desired:
                    return entry

    return None


@lru_cache(maxsize=1)
def get_langfuse_settings() -> LangfuseSettings:
    """Return cached Langfuse Settings instance."""
    langfuse_settings = LangfuseSettings()
    return langfuse_settings


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    settings = Settings()
    return settings


@lru_cache(maxsize=1)
def get_sso_settings() -> SSOSettings:
    """Return cached SSO Settings instance."""
    sso_settings = SSOSettings()
    return sso_settings
