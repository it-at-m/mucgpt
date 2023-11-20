from typing import Any, Mapping, TypedDict
from azure.identity.aio import DefaultAzureCredential
from azure.core.credentials import AccessToken
from approaches.summarize import Summarize
from approaches.simplechat import SimpleChatApproach
from approaches.brainstorm import Brainstorm
from core.authentification import AuthentificationHelper
from core.types.Config import Config


class AppConfig(TypedDict):
    openai_token: AccessToken
    azure_credential: DefaultAzureCredential
    chat_approaches: SimpleChatApproach
    sum_approaches: Summarize
    brainstorm_approaches: Brainstorm
    authentification_client: AuthentificationHelper
    configuration_features: Config