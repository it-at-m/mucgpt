from typing import Any, Mapping, TypedDict
from azure.identity.aio import DefaultAzureCredential
from core.types.AzureChatGPTConfig import AzureChatGPTConfig
from approaches.summarize import Summarize
from approaches.chat import ChatApproach
from approaches.brainstorm import Brainstorm
from core.authentification import AuthentificationHelper
from core.types.Config import Config
from core.datahelper import Repository
from core.types.Config import BackendConfig

class AppConfig(TypedDict):
    model_info: AzureChatGPTConfig
    azure_credential: DefaultAzureCredential
    chat_approaches: ChatApproach
    sum_approaches: Summarize
    brainstorm_approaches: Brainstorm
    authentification_client: AuthentificationHelper
    configuration_features: Config
    repository: Repository
    backend_config: BackendConfig