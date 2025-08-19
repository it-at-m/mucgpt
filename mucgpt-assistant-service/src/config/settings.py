from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class SSOSettings(BaseSettings):
    USERINFO_URL: Optional[str] = None
    ROLE: Optional[str] = None

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_prefix="MUCGPT_SSO_",
    )


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
