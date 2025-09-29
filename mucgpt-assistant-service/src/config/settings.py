from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class SSOSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_SSO_",
        extra="ignore",
    )
    ROLE: str = "lhm-ab-mucgpt-user"


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    UNAUTHORIZED_USER_REDIRECT_URL: str = ""
    LOG_CONFIG: str = "logconf.yaml"

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_prefix="MUCGPT_ASSISTANT_",
    )


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
