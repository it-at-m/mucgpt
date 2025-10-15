from functools import lru_cache
from typing import List

from pydantic import BaseModel, Field, HttpUrl, PositiveInt, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelsConfig(BaseModel):
    type: str = Field(..., min_length=1)
    llm_name: str = Field(..., min_length=1)
    deployment: str = ""
    endpoint: HttpUrl
    api_key: SecretStr
    api_version: str = ""
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str = ""

    @field_validator("api_key", mode="before")
    def parse_secret(cls, value):
        if isinstance(value, str):
            return SecretStr(value)
        return value


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
