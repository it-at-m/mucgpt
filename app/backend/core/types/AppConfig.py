from typing import TypedDict

from brainstorm.brainstorm import Brainstorm
from chat.chat import Chat
from core.authentification import AuthentificationHelper
from core.datahelper import Repository
from core.types.Config import BackendConfig, Config
from simply.simply import Simply
from summarize.summarize import Summarize


class AppConfig(TypedDict):
    """Config for the app, contains all clients and informations, that are needed
    """
    chat_approaches: Chat
    sum_approaches: Summarize
    brainstorm_approaches: Brainstorm
    simply_approaches: Simply
    authentification_client: AuthentificationHelper
    configuration_features: Config
    repository: Repository
    backend_config: BackendConfig