from azure.core.credentials import AccessToken
from typing import TypedDict


class AzureChatGPTConfig(TypedDict):
    model: str
    openai_token: AccessToken
    openai_api_key: str
    openai_api_base: str
    openai_api_version: str
    openai_api_type: str