from typing import Any, Mapping, TypedDict


class ApproachConfig(TypedDict):
    log_tokens: bool

class ModelsConfig(TypedDict):
    type: str
    model_name: str
    deployment: str
    endpoint: str
    api_key: str
    api_version: str
    max_output_tokens: int
    max_input_tokens: int

class ModelsDTO(TypedDict):
    model_name: str
    max_output_tokens: int
    max_input_tokens: int
    description: str

class SSOConfig(TypedDict):
    sso_issuer: str
    role: str
class DatabaseConfig(TypedDict):
    db_host: str
    db_name: str
    db_user: str
    db_passwort: str
class BackendConfig(TypedDict):
    enable_auth: bool
    enable_database: bool
    sso_config: SSOConfig
    db_config: DatabaseConfig
    chat: ApproachConfig
    brainstorm: ApproachConfig
    sum: ApproachConfig
    models: ModelsConfig

class LabelsConfig(TypedDict):
    env_name: str

class FrontendConfig(TypedDict):
    labels: LabelsConfig
    alternative_logo: bool

class Config(TypedDict):
    """Config for an environment, is loaded from ressources/env.json
    """
    version: str
    frontend: FrontendConfig
    backend: BackendConfig



def to_typed_config(config: Mapping[str, Any]) -> Config:
    """Converts a mapping to a Config.

    Args:
        config (Mapping[str, Any]): contains the config

    Raises:
        ValueError: if a key is not found in the mapping, a exception is thrown

    Returns:
        Config: The new typesave config
    """
    result = Config()
    for key, key_type in Config.__annotations__.items():
        if key not in config:
            raise ValueError(f"Key: {key} is not available in data.")
        result[key] = key_type(config[key])
    return result

