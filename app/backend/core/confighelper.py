import re
from os import environ, getenv

from core.types.Config import (
    ApproachConfig,
    BackendConfig,
    Config,
    DatabaseConfig,
    FrontendConfig,
    LabelsConfig,
    ModelsConfig,
    SSOConfig,
)
from core.version import get_latest_commit, get_version


class ConfigHelper:
    def _find_highest_index(self):
        pattern = re.compile(r"BACKEND_MODEL_(\d+)")
        highest_index = 0
        for key in environ:
            match = pattern.match(key)
            if match:
                index = int(match.group(1))
                if index > highest_index:
                    highest_index = index
        return highest_index

    def _get_model_config(self, index):
        prefix = f"BACKEND_MODEL_{index}_"
        config = ModelsConfig(
            type= getenv(f"{prefix}TYPE"),
            llm_name= getenv(f"{prefix}LLM_NAME"),
            deployment= getenv(f"{prefix}DEPLOYMENT", ""),
            endpoint= getenv(f"{prefix}ENDPOINT"),
            api_key= getenv(f"{prefix}API_KEY"),
            max_output_tokens= getenv(f"{prefix}MAX_OUTPUT_TOKENS"),
            max_input_tokens= getenv(f"{prefix}MAX_INPUT_TOKENS"),
            api_version=  getenv(f"{prefix}API_VERSION", ""),
            description = getenv(f"{prefix}DESCRIPTION"),
        )
        return config

    def _get_models_config(self):
        models_config = []
        highest_index = self._find_highest_index()
        for i in range(1, highest_index + 1):
            models_config.append(self._get_model_config(i))
        return models_config

    def loadData(self) -> Config:
        models_config = self._get_models_config()
        labelsConfig = LabelsConfig(env_name=getenv("FRONTEND_LABELS_ENV_NAME", "MUCGPT"))
        frontendConfig = FrontendConfig(labels=labelsConfig,
                       alternative_logo=getenv("FRONTEND_ALTERNATIVE_LOGO", "false").lower() == "true",
                       enable_simply=getenv("FRONTEND_ENABLE_SIMPLY", "true").lower() == "true")
        ssoConfig = SSOConfig(sso_issuer=getenv("BACKEND_SSO_ISSUER", ""),
                              role=getenv("BACKEND_SSO_ROLE","lhm-ab-mucgpt-user"))
        dbConfig = DatabaseConfig(db_host=getenv("BACKEND_DB_HOST", ""),
                                  db_name=getenv("BACKEND_DB_NAME", ""),
                                  db_user=getenv("BACKEND_DB_USER", ""),
                                  db_passwort=getenv("BACKEND_DB_PASSWORT", ""))
        backendConfig = BackendConfig(enable_auth=getenv("BACKEND_ENABLE_AUTH", "false") == "true",
                                      enable_database=getenv("BACKEND_ENABLE_DATABASE", "false") == "true",
                                      unauthorized_user_redirect_url=getenv("BACKEND_UNAUTHORIZED_USER_REDIRECT_URL", ""),
                                      sso_config=ssoConfig,
                                      db_config=dbConfig,
                                      chat= ApproachConfig(log_tokens=getenv("BACKEND_CHAT_LOG_TOKENS", "false") == "true"),
                                      brainstorm= ApproachConfig(log_tokens=getenv("BACKEND_BRAINSTORM_LOG_TOKENS", "false") == "true"),
                                      sum= ApproachConfig(log_tokens=getenv("BACKEND_SUM_LOG_TOKENS", "false") == "true"),
                                      simply= ApproachConfig(log_tokens=getenv("BACKEND_SIMPLY_LOG_TOKENS", "false") == "true"),
                                      models=models_config
                                      )
        return Config(version=get_version(),
                      commit=get_latest_commit(),
                      frontend=frontendConfig,
                      backend=backendConfig)
