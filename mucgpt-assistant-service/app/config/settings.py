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
    """SSO configuration (nested under sso key in YAML)."""

    role: str | None = None
    admin_role: str | None = None
    user_id_claim: str = "user_id"
    organization_unit_claim: str = "organization_unit"


class DBConfig(BaseModel):
    """Database configuration (nested under db key in YAML)."""

    host: str
    port: int = 5432
    name: str
    user: str
    password: SecretStr
    schema: str | None = None


class RedisConfig(BaseModel):
    """Redis configuration (nested under redis key in YAML)."""

    host: str | None = None
    port: int = 6379
    username: str | None = None
    password: SecretStr | None = None


class LDAPConfig(BaseModel):
    """LDAP configuration (nested under ldap key in YAML)."""

    enabled: bool = False
    host: str | None = None
    port: int = 636
    use_ssl: bool = True
    start_tls: bool = False
    verify_ssl: bool = True
    ca_cert_file: str | None = None
    bind_dn: str | None = None
    bind_password: SecretStr | None = None
    search_base: str = "dc=example,dc=org"
    search_filter: str = "(objectClass=organizationalUnit)"
    display_attribute: str = "ou"
    shortname_attribute: str = "departmentCode"
    parent_attribute: str | None = None
    additional_attributes: list[str] | None = None
    required_attributes: list[str] = Field(default_factory=list)
    ignored_ou_prefixes: list[str] = Field(default_factory=lambda: ["_"])
    ignored_ou_suffixes: list[str] = Field(default_factory=lambda: ["-xxx"])
    ignored_ou_shortname_exceptions: list[str] = Field(default_factory=list)
    cache_ttl: int = 14 * 24 * 60 * 60
    page_size: int = 500
    connect_timeout: float = 5.0
    read_timeout: float = 10.0
    user_search_base: str | None = None
    user_search_filter: str = "(objectClass=person)"
    user_search_attributes: list[str] = Field(
        default_factory=lambda: [
            "givenName",
            "sn",
            "mail",
            "userId",
            "organizationUnit",
        ]
    )
    user_id_attribute: str = "userId"
    user_given_name_attribute: str = "givenName"
    user_surname_attribute: str = "sn"
    user_mail_attribute: str = "mail"
    user_organizational_unit_attribute: str = "organizationUnit"


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
    unauthorized_user_redirect_url: str = ""
    log_config: str = str(Path(__file__).resolve().parent.parent / "logconf.yaml")
    owner_cache_refresh_on_read: bool = False
    compliance_require_verification: bool = True
    compliance_require_legal_review: bool = True

    # Nested sub-configurations
    db: DBConfig
    sso: SSOConfig = Field(default_factory=SSOConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    ldap: LDAPConfig = Field(default_factory=LDAPConfig)

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
    return get_settings().sso


@lru_cache(maxsize=1)
def get_ldap_settings() -> LDAPConfig:
    """Return cached LDAP Settings instance."""
    return get_settings().ldap


@lru_cache(maxsize=1)
def get_redis_settings() -> RedisConfig:
    """Return cached Redis Settings instance."""
    return get_settings().redis
