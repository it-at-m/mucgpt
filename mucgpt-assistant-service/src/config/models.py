from typing import List
from pydantic import BaseModel


class SSOConfig(BaseModel):
    sso_issuer: str
    role: str


class DatabaseConfig(BaseModel):
    db_host: str
    db_port: str
    db_name: str
    db_user: str
    db_password: str


class BackendConfig(BaseModel):
    enable_auth: bool = True
    unauthorized_user_redirect_url: str
    sso_config: SSOConfig
    db_config: DatabaseConfig


class ExampleModel(BaseModel):
    text: str
    value: str
    system: str = ""


class QuickPrompt(BaseModel):
    label: str
    prompt: str
    tooltip: str


class CommunityAssistantConfig(BaseModel):
    title: str
    description: str
    system_message: str
    publish: bool = True
    id: str
    temperature: float
    max_output_tokens: int
    examples: List[ExampleModel]
    quick_prompts: List[QuickPrompt]


class Config(BaseModel):
    """Config for an environment, is loaded from ressources/env.json"""

    version: str
    commit: str
    backend: BackendConfig
    community_assistants: List[CommunityAssistantConfig] = []
