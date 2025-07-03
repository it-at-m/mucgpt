from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings

from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


class Settings(BaseSettings):
    MUCGPT_ASSISTANT_SSO_USERINFO_URL: Optional[str] = None
    MUCGPT_ASSISTANT_SSO_ROLE: Optional[str] = None

    MUCGPT_ASSISTANT_DB_HOST: str
    MUCGPT_ASSISTANT_DB_PORT: int = 5432
    MUCGPT_ASSISTANT_DB_NAME: str
    MUCGPT_ASSISTANT_DB_USER: str
    MUCGPT_ASSISTANT_DB_PASSWORD: str
    MUCGPT_ASSISTANT_ENABLE_AUTH: bool = True
    MUCGPT_ASSISTANT_UNAUTHORIZED_USER_REDIRECT_URL: str = ""

    model_config = {"case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    logger.info("Loading settings from environment variables...")

    try:
        settings = Settings()
        logger.info(
            f"Settings loaded successfully: {settings.model_dump(exclude={'MUCGPT_ASSISTANT_DB_PASSWORD'})}"
        )
        return settings
    except Exception as e:
        logger.error(f"Failed to load settings: {e}")
        raise
