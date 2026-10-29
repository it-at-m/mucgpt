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
    """Database configuration (nested under db key in YAML)."""

    host: str | None = None
    port: int = 5432
    name: str | None = None
    user: str | None = None
    password: SecretStr | None = None
    schema: str | None = None


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
    db: DBConfig = DBConfig()

    # Also support getting the full URL if provided
    database_url: str | None = None

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

    if settings.database_url:
        return settings.database_url

    db = settings.db
    if not all([db.user, db.password, db.host, db.name]):
        print(
            f"Loaded Config: Host={db.host}, Port={db.port}, User={db.user}, Name={db.name}",
            file=sys.stderr,
        )
        raise ValueError(
            "Missing required database configuration (db.user, db.password, db.host, db.name)"
        )

    password = db.password.get_secret_value() if db.password else ""
    return URL.create(
        drivername="postgresql+asyncpg",
        username=db.user,
        password=password,
        host=db.host,
        port=db.port,
        database=db.name,
    )


def get_db_schema() -> str | None:
    """Return the optional PostgreSQL schema from settings (db.schema)."""
    return MigrationSettings().db.schema
