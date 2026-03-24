from enum import Enum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ParserBackendType(str, Enum):
    KREUZBERG = "kreuzberg"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Parsing
    PARSER_BACKEND: ParserBackendType = ParserBackendType.KREUZBERG

    # Kreuzberg backend
    KREUZBERG_URL: str = ""
    KREUZBERG_TIMEOUT: float = 120.0

    # Service
    LOG_CONFIG: str = "logconf.yaml"
    APP_VERSION: str = "unknown"


@lru_cache
def get_settings() -> Settings:
    return Settings()
