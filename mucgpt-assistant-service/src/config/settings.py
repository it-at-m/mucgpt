from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)


class SSOSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_SSO_",
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        yaml_file="config.yaml",
        yaml_file_encoding="utf-8",
    )
    ROLE: str = "lhm-ab-mucgpt-user"

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


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    UNAUTHORIZED_USER_REDIRECT_URL: str = ""
    LOG_CONFIG: str = str(Path(__file__).resolve().parent.parent / "logconf.yaml")

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_prefix="MUCGPT_ASSISTANT_",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        yaml_file="config.yaml",
        yaml_file_encoding="utf-8",
    )

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


class RedisSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_REDIS_",
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        yaml_file="config.yaml",
        yaml_file_encoding="utf-8",
    )

    HOST: str | None = None
    PORT: int = 6379
    USERNAME: str | None = None
    PASSWORD: str | None = None

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


class LDAPSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MUCGPT_LDAP_",
        case_sensitive=False,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        yaml_file="config.yaml",
        yaml_file_encoding="utf-8",
    )

    ENABLED: bool = False
    HOST: str | None = None
    PORT: int = 636
    USE_SSL: bool = True
    START_TLS: bool = False
    VERIFY_SSL: bool = True
    CA_CERT_FILE: str | None = None
    BIND_DN: str | None = None
    BIND_PASSWORD: SecretStr | None = None
    SEARCH_BASE: str = "o=Landeshauptstadt München,c=de"
    SEARCH_FILTER: str = "(objectClass=organizationalUnit)"
    DISPLAY_ATTRIBUTE: str = "ou"
    PARENT_ATTRIBUTE: str | None = None
    ADDITIONAL_ATTRIBUTES: list[str] | None = None
    REQUIRED_ATTRIBUTES: list[str] = Field(
        default_factory=lambda: ["lhmOULongname", "lhmOUShortname"]
    )
    IGNORED_OU_PREFIXES: list[str] = Field(default_factory=lambda: ["_"])
    IGNORED_OU_SUFFIXES: list[str] = Field(default_factory=lambda: ["-xxx"])
    PAGE_SIZE: int = 500
    CONNECT_TIMEOUT: float = 5.0
    READ_TIMEOUT: float = 10.0

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


@lru_cache(maxsize=1)
def get_ldap_settings() -> LDAPSettings:
    """Return cached LDAP Settings instance."""
    ldap_settings = LDAPSettings()
    return ldap_settings


@lru_cache(maxsize=1)
def get_redis_settings() -> RedisSettings:
    """Return cached Redis Settings instance."""
    redis_settings = RedisSettings()
    return redis_settings
