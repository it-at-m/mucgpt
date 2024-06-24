from typing import Any, Mapping, TypedDict


class ApproachConfig(TypedDict):
    log_tokens: bool

class BackendConfig(TypedDict):
    enable_database: bool
    chat: ApproachConfig
    brainstorm: ApproachConfig
    sum: ApproachConfig

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

