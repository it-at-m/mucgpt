import logging
from os import getenv

from .models import (
    BackendConfig,
    Config,
    DatabaseConfig,
    SSOConfig,
)
from .version import get_latest_commit, get_version

logger = logging.getLogger()


class ConfigHelper:
    def loadData(self) -> Config:
        ssoConfig = SSOConfig(
            sso_issuer=getenv("BACKEND_SSO_ISSUER", ""),
            role=getenv("BACKEND_SSO_ROLE", "lhm-ab-mucgpt-user"),
        )
        dbConfig = DatabaseConfig(
            db_host=getenv("BACKEND_DB_HOST", ""),
            db_name=getenv("BACKEND_DB_NAME", ""),
            db_user=getenv("BACKEND_DB_USER", ""),
            db_password=getenv("BACKEND_DB_PASSWORD", ""),
        )
        backendConfig = BackendConfig(
            enable_auth=getenv("BACKEND_ENABLE_AUTH", "false").lower() == "true",
            unauthorized_user_redirect_url=getenv(
                "BACKEND_UNAUTHORIZED_USER_REDIRECT_URL", ""
            ),
            sso_config=ssoConfig,
            db_config=dbConfig,
        )
        return Config(
            version=get_version(),
            commit=get_latest_commit(),
            backend=backendConfig,
        )
