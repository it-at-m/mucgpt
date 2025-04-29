import logging
import re
from os import environ, getenv

from core.types.Config import (
    ApproachConfig,
    BackendConfig,
    CommunityAssistantConfig,
    Config,
    DatabaseConfig,
    ExampleModel,
    FrontendConfig,
    LabelsConfig,
    ModelsConfig,
    QuickPrompt,
    SSOConfig,
)
from core.version import get_latest_commit, get_version

logger = logging.getLogger()


class ConfigHelper:
    def _find_highest_index(self, regex: str) -> int:
        pattern = re.compile(regex)
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
            type=getenv(f"{prefix}TYPE"),
            llm_name=getenv(f"{prefix}LLM_NAME"),
            deployment=getenv(f"{prefix}DEPLOYMENT", ""),
            endpoint=getenv(f"{prefix}ENDPOINT"),
            api_key=getenv(f"{prefix}API_KEY"),
            max_output_tokens=getenv(f"{prefix}MAX_OUTPUT_TOKENS"),
            max_input_tokens=getenv(f"{prefix}MAX_INPUT_TOKENS"),
            api_version=getenv(f"{prefix}API_VERSION", ""),
            description=getenv(f"{prefix}DESCRIPTION"),
        )
        return config

    def _get_quick_prompt(self, assistant, index):
        prefix = f"BACKEND_COMMUNITY_ASSISTANT_{assistant}_QUICK_PROMPT_{index}_"
        config = QuickPrompt(
            label=getenv(f"{prefix}LABEL", f"Quick Prompt {index}"),
            prompt=getenv(f"{prefix}PROMPT", f"Quick Prompt {index}"),
            tooltip=getenv(f"{prefix}TOOLTIP", ""),
        )
        return config

    def _get_quick_prompt_list(self, assistant):
        quick_prompts = []
        highest_index = self._find_highest_index(
            r"BACKEND_COMMUNITY_ASSISTANT_" + str(assistant) + r"_QUICK_PROMPT_(\d+)"
        )
        for i in range(1, highest_index + 1):
            quick_prompts.append(self._get_quick_prompt(assistant, i))
        return quick_prompts

    def _get_example(self, assistant, index):
        prefix = f"BACKEND_COMMUNITY_ASSISTANT_{assistant}_EXAMPLES_{index}_"
        config = ExampleModel(
            text=getenv(f"{prefix}TEXT", f"Example {index}"),
            value=getenv(f"{prefix}VALUE", f"Example {index}"),
            system=getenv(f"{prefix}SYSTEM", ""),
        )
        return config

    def _get_example_list(self, assistant):
        examples = []
        highest_index = self._find_highest_index(
            r"BACKEND_COMMUNITY_ASSISTANT_" + str(assistant) + r"_EXAMPLES_(\d+)"
        )
        for i in range(1, highest_index + 1):
            examples.append(self._get_example(assistant, i))
        return examples

    def _get_community_assistant(self, index):
        prefix = f"BACKEND_COMMUNITY_ASSISTANT_{index}_"
        id = getenv(f"{prefix}ID")
        if id is None:
            raise Exception(
                f"ID is missing for community assistant {index}. Please provide the env variable BACKEND_COMMUNITY_ASSISTANT_{index}_ID."
            )
        config = CommunityAssistantConfig(
            title=getenv(f"{prefix}TITLE", f"Title {index}"),
            description=getenv(f"{prefix}DESCRIPTION", ""),
            system_message=getenv(f"{prefix}SYSTEM_MESSAGE", ""),
            examples=self._get_example_list(index),
            quick_prompts=self._get_quick_prompt_list(index),
            temperature=float(getenv(f"{prefix}TEMPERATURE", 0.7)),
            max_output_tokens=int(getenv(f"{prefix}MAX_TOKENS", 100)),
            id=id,
        )
        return config

    def _get_community_assistants(self):
        community_assistants = []
        highest_index = self._find_highest_index(r"BACKEND_COMMUNITY_ASSISTANT_(\d+)")
        for i in range(1, highest_index + 1):
            try:
                community_assistants.append(self._get_community_assistant(i))
            except Exception as e:
                logger.error(f"Error while loading community assistant {i}: {e}")
        return community_assistants

    def _get_models_config(self):
        models_config = []
        highest_index = self._find_highest_index(r"BACKEND_MODEL_(\d+)")
        for i in range(1, highest_index + 1):
            models_config.append(self._get_model_config(i))
        return models_config

    def loadData(self) -> Config:
        models_config = self._get_models_config()
        labelsConfig = LabelsConfig(
            env_name=getenv("FRONTEND_LABELS_ENV_NAME", "MUCGPT")
        )
        frontendConfig = FrontendConfig(
            labels=labelsConfig,
            alternative_logo=getenv("FRONTEND_ALTERNATIVE_LOGO", "false").lower()
            == "true",
            enable_simply=getenv("FRONTEND_ENABLE_SIMPLY", "true").lower() == "true",
            community_assistants=self._get_community_assistants(),
        )
        ssoConfig = SSOConfig(
            sso_issuer=getenv("BACKEND_SSO_ISSUER", ""),
            role=getenv("BACKEND_SSO_ROLE", "lhm-ab-mucgpt-user"),
        )
        dbConfig = DatabaseConfig(
            db_host=getenv("BACKEND_DB_HOST", ""),
            db_name=getenv("BACKEND_DB_NAME", ""),
            db_user=getenv("BACKEND_DB_USER", ""),
            db_passwort=getenv("BACKEND_DB_PASSWORD", ""),
        )
        backendConfig = BackendConfig(
            enable_auth=getenv("BACKEND_ENABLE_AUTH", "false") == "true",
            enable_database=getenv("BACKEND_ENABLE_DATABASE", "false") == "true",
            unauthorized_user_redirect_url=getenv(
                "BACKEND_UNAUTHORIZED_USER_REDIRECT_URL", ""
            ),
            sso_config=ssoConfig,
            db_config=dbConfig,
            chat=ApproachConfig(
                log_tokens=getenv("BACKEND_CHAT_LOG_TOKENS", "false") == "true"
            ),
            brainstorm=ApproachConfig(
                log_tokens=getenv("BACKEND_BRAINSTORM_LOG_TOKENS", "false") == "true"
            ),
            sum=ApproachConfig(
                log_tokens=getenv("BACKEND_SUM_LOG_TOKENS", "false") == "true"
            ),
            simply=ApproachConfig(
                log_tokens=getenv("BACKEND_SIMPLY_LOG_TOKENS", "false") == "true"
            ),
            models=models_config,
        )
        return Config(
            version=get_version(),
            commit=get_latest_commit(),
            frontend=frontendConfig,
            backend=backendConfig,
        )
