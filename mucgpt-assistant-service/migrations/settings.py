from __future__ import annotations

from functools import cache

from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)
from sqlalchemy import URL


class DBConfig(BaseModel):
    """The only application configuration needed by the migration Job."""

    host: str | None = None
    port: int = 5432
    name: str | None = None
    user: str | None = None
    password: SecretStr | None = None
    schema_name: str | None = Field(default=None, alias="schema")


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

    db: DBConfig = DBConfig()

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

    def database_url(self) -> URL:
        db = self.db
        if not all((db.host, db.name, db.user, db.password)):
            raise ValueError(
                "Missing required database configuration: db.host, db.name, db.user, db.password"
            )
        password = db.password
        assert password is not None
        return URL.create(
            drivername="postgresql+asyncpg",
            host=db.host,
            port=db.port,
            database=db.name,
            username=db.user,
            password=password.get_secret_value(),
        )


@cache
def get_migration_settings() -> MigrationSettings:
    return MigrationSettings()
