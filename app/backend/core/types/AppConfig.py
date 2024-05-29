from typing import Any, Mapping, TypedDict
from azure.identity.aio import DefaultAzureCredential
from azure.core.credentials import AccessToken
from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm
from core.authentification import AuthentificationHelper
from core.types.Config import Config
from core.datahelper import Repository
from core.types.Config import BackendConfig

class OpenaiInfo(TypedDict):
    model: str
    openai_token: AccessToken
    openai_api_key: str
    openai_api_base: str
    openai_api_version: str
    openai_api_type: str

class AppConfig(TypedDict):
    model_info: OpenaiInfo
    azure_credential: DefaultAzureCredential
    chat_approaches: SimpleChatApproach
    sum_approaches: Summarize
    brainstorm_approaches: Brainstorm
    authentification_client: AuthentificationHelper
    configuration_features: Config
    repository: Repository
    backend_config: BackendConfig