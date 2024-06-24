from typing import TypedDict
from azure.identity.aio import DefaultAzureCredential
from core.types.AzureChatGPTConfig import AzureChatGPTConfig
from summarize.summarize import Summarize
from chat.chat import Chat
from brainstorm.brainstorm import Brainstorm
from core.authentification import AuthentificationHelper
from core.types.Config import Config
from core.datahelper import Repository
from core.types.Config import BackendConfig

class AppConfig(TypedDict):
    model_info: AzureChatGPTConfig
    azure_credential: DefaultAzureCredential
    chat_approaches: Chat
    sum_approaches: Summarize
    brainstorm_approaches: Brainstorm
    authentification_client: AuthentificationHelper
    configuration_features: Config
    repository: Repository
    backend_config: BackendConfig