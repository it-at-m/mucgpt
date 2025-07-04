from functools import lru_cache
from typing import List

from pydantic import BaseModel, Field, HttpUrl, PositiveInt, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.version import VersionInfo


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


class ModelsDTO(BaseModel):
    llm_name: str
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str


class SSOConfig(BaseModel):
    sso_userinfo_url: str = ""
    role: str = "lhm-ab-mucgpt-user"


class BackendConfig(BaseModel):
    enable_auth: bool = False
    unauthorized_user_redirect_url: str = ""
    sso_config: SSOConfig = Field(default_factory=SSOConfig)
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
    log_config: str = "logconf.yaml"

    # Frontend settings
    frontend: FrontendConfig = Field(default_factory=FrontendConfig)

    # Backend settings
    backend: BackendConfig = Field(default_factory=BackendConfig)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set version and commit if not provided via environment
        if not self.version:
            self.version = VersionInfo.get_commit
        if not self.commit:
            self.commit = VersionInfo.get_version


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    settings = Settings()
    return settings
