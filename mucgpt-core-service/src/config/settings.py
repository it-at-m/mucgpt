import os
from functools import lru_cache
from typing import List

from pydantic import BaseModel, Field, HttpUrl, PositiveInt, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.version import get_latest_commit, get_version


class ApproachConfig(BaseModel):
    log_tokens: bool = False


class ModelsConfig(BaseModel):
    type: str = Field(..., min_length=1)
    llm_name: str = Field(..., min_length=1)
    deployment: str = ""
    endpoint: HttpUrl
    api_key: SecretStr
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str = ""

    @field_validator("api_key", mode="before")
    def parse_secret(cls, value):
        if isinstance(value, str):
            return SecretStr(value)
        return value


class ModelsDTO(BaseModel):
    llm_name: str
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str


class SSOConfig(BaseModel):
    sso_issuer: str = ""
    role: str = "lhm-ab-mucgpt-user"


class DatabaseConfig(BaseModel):
    db_host: str = ""
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""


class BackendConfig(BaseModel):
    enable_auth: bool = False
    unauthorized_user_redirect_url: str = ""
    enable_database: bool = False
    sso_config: SSOConfig = Field(default_factory=SSOConfig)
    db_config: DatabaseConfig = Field(default_factory=DatabaseConfig)
    chat: ApproachConfig = Field(default_factory=ApproachConfig)
    brainstorm: ApproachConfig = Field(default_factory=ApproachConfig)
    sum: ApproachConfig = Field(default_factory=ApproachConfig)
    simply: ApproachConfig = Field(default_factory=ApproachConfig)
    models: List[ModelsConfig] = []
    models_json: str = "[]"


class LabelsConfig(BaseModel):
    env_name: str = "MUCGPT"


class FrontendConfig(BaseModel):
    labels: LabelsConfig = Field(default_factory=LabelsConfig)
    alternative_logo: bool = False
    enable_simply: bool = True


class ConfigResponse(BaseModel):
    frontend: FrontendConfig
    models: List[ModelsDTO] = []
    version: str
    commit: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_CORE_",
        env_nested_delimiter="__",
        extra="ignore",
    )

    # General settings
    version: str = Field(default="")
    commit: str = Field(default="")

    # Frontend settings
    frontend: FrontendConfig = Field(default_factory=FrontendConfig)

    # Backend settings
    backend: BackendConfig = Field(default_factory=BackendConfig)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set version and commit if not provided via environment
        if not self.version:
            try:
                self.version = get_version()
            except Exception:
                self.version = os.getenv("MUCGPT_CORE_VERSION", "unknown")

        if not self.commit:
            try:
                self.commit = get_latest_commit()
            except Exception:
                self.commit = os.getenv("MUCGPT_CORE_COMMIT", "unknown")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Alias for backward compatibility
Config = Settings
