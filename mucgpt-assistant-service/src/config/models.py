from pydantic import BaseModel


class SSOConfig(BaseModel):
    sso_issuer: str
    role: str


class DatabaseConfig(BaseModel):
    db_host: str
    db_name: str
    db_user: str
    db_password: str


class BackendConfig(BaseModel):
    unauthorized_user_redirect_url: str
    sso_config: SSOConfig
    db_config: DatabaseConfig


class Config(BaseModel):
    """Config for an environment, is loaded from ressources/env.json"""

    version: str
    commit: str
    backend: BackendConfig
