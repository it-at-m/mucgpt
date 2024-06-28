from typing import TypedDict

from azure.core.credentials import AccessToken


class AzureChatGPTConfig(TypedDict):
    """Contains all information, that describes an AzureOpenAI endpoint
    """
    model: str
    openai_token: AccessToken
    openai_api_key: str
    openai_api_base: str
    openai_api_version: str
    openai_api_type: str