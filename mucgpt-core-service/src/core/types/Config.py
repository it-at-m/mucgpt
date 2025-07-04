from typing import List

from pydantic import BaseModel, HttpUrl, PositiveInt


class ApproachConfig(BaseModel):
    log_tokens: bool


class ModelsConfig(BaseModel):
    type: str
    llm_name: str
    deployment: str = ""
    endpoint: HttpUrl
    api_key: str
    api_version: str = ""
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str


class ModelsDTO(BaseModel):
    llm_name: str
    max_output_tokens: PositiveInt
    max_input_tokens: PositiveInt
    description: str


class SSOConfig(BaseModel):
    sso_issuer: str
    role: str


class DatabaseConfig(BaseModel):
    db_host: str
    db_name: str
    db_user: str
    db_password: str


class BackendConfig(BaseModel):
    enable_auth: bool
    unauthorized_user_redirect_url: str
    enable_database: bool
    sso_config: SSOConfig
    db_config: DatabaseConfig
    chat: ApproachConfig
    brainstorm: ApproachConfig
    sum: ApproachConfig
    simply: ApproachConfig
    models: List[ModelsConfig]


class LabelsConfig(BaseModel):
    env_name: str = "MUCGPT"


class FrontendConfig(BaseModel):
    labels: LabelsConfig
    alternative_logo: bool = False
    enable_simply: bool = True


class Config(BaseModel):
    """Config for an environment, is loaded from ressources/env.json"""

    version: str
    commit: str
    frontend: FrontendConfig
    backend: BackendConfig


class ConfigResponse(BaseModel):
    frontend: FrontendConfig
    models: List[ModelsDTO] = []
    version: str
    commit: str
