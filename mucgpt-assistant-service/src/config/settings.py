from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)

# ---------------------------------------------------------------------------
# Nested sub-configuration models (BaseModel, NOT BaseSettings)
# ---------------------------------------------------------------------------


class SSOConfig(BaseModel):
    """SSO configuration (nested under SSO key in YAML)."""

    ROLE: str = "lhm-ab-mucgpt-user"


class DBConfig(BaseModel):
    """Database configuration (nested under DB key in YAML)."""

    HOST: str
    PORT: int = 5432
    NAME: str
    USER: str
    PASSWORD: SecretStr


class RedisConfig(BaseModel):
    """Redis configuration (nested under REDIS key in YAML)."""

    HOST: str | None = None
    PORT: int = 6379
    USERNAME: str | None = None
    PASSWORD: SecretStr | None = None


class LDAPConfig(BaseModel):
    """LDAP configuration (nested under LDAP key in YAML)."""

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


# Backward-compatible aliases so existing imports keep working
SSOSettings = SSOConfig
RedisSettings = RedisConfig
LDAPSettings = LDAPConfig


# ---------------------------------------------------------------------------
# Main Settings class – single BaseSettings that loads everything
# ---------------------------------------------------------------------------


class Settings(BaseSettings):
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

    # General settings
    UNAUTHORIZED_USER_REDIRECT_URL: str = ""
    LOG_CONFIG: str = str(Path(__file__).resolve().parent.parent / "logconf.yaml")

    # Nested sub-configurations
    DB: DBConfig
    SSO: SSOConfig = Field(default_factory=SSOConfig)
    REDIS: RedisConfig = Field(default_factory=RedisConfig)
    LDAP: LDAPConfig = Field(default_factory=LDAPConfig)

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
# Cached getters (backward-compatible)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


@lru_cache(maxsize=1)
def get_sso_settings() -> SSOConfig:
    """Return cached SSO Settings instance."""
    return get_settings().SSO


@lru_cache(maxsize=1)
def get_ldap_settings() -> LDAPConfig:
    """Return cached LDAP Settings instance."""
    return get_settings().LDAP


@lru_cache(maxsize=1)
def get_redis_settings() -> RedisConfig:
    """Return cached Redis Settings instance."""
    return get_settings().REDIS
