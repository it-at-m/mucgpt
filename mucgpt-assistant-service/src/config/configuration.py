from functools import lru_cache
from os import getenv

from .models import (
    BackendConfig,
    Config,
    DatabaseConfig,
    SSOConfig,
)
from .version import get_latest_commit, get_version


class ConfigHelper:
    def loadData(self) -> Config:
        ssoConfig = SSOConfig(
            sso_issuer=getenv("MUCGPT_ASSISTANT_SSO_ISSUER", ""),
            role=getenv("MUCGPT_ASSISTANT_SSO_ROLE", "lhm-ab-mucgpt-user"),
        )
        dbConfig = DatabaseConfig(
            db_host=getenv("MUCGPT_ASSISTANT_DB_HOST", ""),
            db_port=getenv("MUCGPT_ASSISTANT_DB_PORT", "5432"),
            db_name=getenv("MUCGPT_ASSISTANT_DB_NAME", ""),
            db_user=getenv("MUCGPT_ASSISTANT_DB_USER", ""),
            db_password=getenv("MUCGPT_ASSISTANT_DB_PASSWORD", ""),
        )
        backendConfig = BackendConfig(
            enable_auth=getenv("MUCGPT_ASSISTANT_ENABLE_AUTH", "true").lower()
            == "true",
            unauthorized_user_redirect_url=getenv(
                "MUCGPT_ASSISTANT_UNAUTHORIZED_USER_REDIRECT_URL", ""
            ),
            sso_config=ssoConfig,
            db_config=dbConfig,
        )
        return Config(
            version=get_version(),
            commit=get_latest_commit(),
            backend=backendConfig,
        )


# Global configuration instance:
# This implementation uses functools.lru_cache to ensure that the configuration is loaded only once per process,
# providing thread-safe, lazy initialization and avoiding repeated environment variable lookups.
@lru_cache(maxsize=1)
def get_config() -> Config:
    """
    Get the application configuration.
    Returns a cached instance of the configuration to avoid repeated environment variable lookups.
    """
    config_helper = ConfigHelper()
    return config_helper.loadData()
