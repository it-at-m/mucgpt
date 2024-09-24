from typing import List, Optional

from pydantic import BaseModel


class ApproachConfig(BaseModel):
    log_tokens: bool

class ModelsConfig(BaseModel):
    type: str
    llm_name: str
    deployment: str=""
    endpoint: str
    api_key: str
    api_version: str = ""
    max_output_tokens: int
    max_input_tokens: int
    description: str

class ModelsDTO(BaseModel):
    llm_name: str
    max_output_tokens: int
    max_input_tokens: int
    description: str

class SSOConfig(BaseModel):
    sso_issuer: str
    role: str

class DatabaseConfig(BaseModel):
    db_host: str
    db_name: str
    db_user: str
    db_passwort: str

class BackendConfig(BaseModel):
    enable_auth: bool
    enable_database: bool
    sso_config: SSOConfig
    db_config: DatabaseConfig
    chat: ApproachConfig
    brainstorm: ApproachConfig
    sum: ApproachConfig
    models: List[ModelsConfig]

class LabelsConfig(BaseModel):
    env_name: str = "MUCGPT"

class FrontendConfig(BaseModel):
    labels: LabelsConfig 
    alternative_logo: bool = False

class Config(BaseModel):
    """Config for an environment, is loaded from ressources/env.json
    """
    version: str
    frontend: FrontendConfig
    backend: BackendConfig

class ConfigResponse(BaseModel):
    frontend: FrontendConfig = None
    models: List[ModelsDTO] =[]
    version: str = ""
    redirect: Optional[str]

