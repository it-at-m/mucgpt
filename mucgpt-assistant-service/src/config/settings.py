from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SSO_USERINFO_URL: Optional[str] = None
    SSO_ROLE: Optional[str] = None

    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    ENABLE_AUTH: bool = True
    UNAUTHORIZED_USER_REDIRECT_URL: str = ""
    LOG_CONFIG: str = "logconf.yaml"

    model_config = {
        "case_sensitive": False,
        "env_prefix": "MUCGPT_ASSISTANT_",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    settings = Settings()
    return settings
