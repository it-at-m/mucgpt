from __future__ import annotations

import sys

from pydantic import BaseModel, SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)
from sqlalchemy.engine import URL

# ---------------------------------------------------------------------------
# Nested sub-configuration model
# ---------------------------------------------------------------------------


class DBConfig(BaseModel):
    """Database configuration (nested under DB key in YAML)."""

    HOST: str | None = None
    PORT: int = 5432
    NAME: str | None = None
    USER: str | None = None
    PASSWORD: SecretStr | None = None
    SCHEMA: str | None = None


# ---------------------------------------------------------------------------
# Main Settings class
# ---------------------------------------------------------------------------


class MigrationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=False,
        env_prefix="MUCGPT_ASSISTANT_",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        env_nested_delimiter="__",
        nested_model_default_partial_update=True,
        yaml_file="config.yaml",
        yaml_file_encoding="utf-8",
    )

    # Nested DB configuration
    DB: DBConfig = DBConfig()

    # Also support getting the full URL if provided
    DATABASE_URL: str | None = None

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            env_settings,
            YamlConfigSettingsSource(settings_cls),
            dotenv_settings,
        )


# ---------------------------------------------------------------------------
# Helper to build the database URL
# ---------------------------------------------------------------------------


def get_db_url() -> str | URL:
    settings = MigrationSettings()

    if settings.DATABASE_URL:
        return settings.DATABASE_URL

    db = settings.DB
    if not all([db.USER, db.PASSWORD, db.HOST, db.NAME]):
        print(
            f"Loaded Config: Host={db.HOST}, Port={db.PORT}, User={db.USER}, Name={db.NAME}",
            file=sys.stderr,
        )
        raise ValueError(
            "Missing required database configuration (DB.USER, DB.PASSWORD, DB.HOST, DB.NAME)"
        )

    password = db.PASSWORD.get_secret_value() if db.PASSWORD else ""
    return URL.create(
        drivername="postgresql+asyncpg",
        username=db.USER,
        password=password,
        host=db.HOST,
        port=db.PORT,
        database=db.NAME,
    )


def get_db_schema() -> str | None:
    """Return the optional PostgreSQL schema from settings (DB.SCHEMA)."""
    return MigrationSettings().DB.SCHEMA
