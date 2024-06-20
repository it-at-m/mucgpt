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
    version: str
    frontend: FrontendConfig
    backend: BackendConfig



def to_typed_config(config: Mapping[str, Any]) -> Config:
    result = Config()
    for key, key_type in Config.__annotations__.items():
        if key not in config:
            raise ValueError(f"Key: {key} is not available in data.")
        result[key] = key_type(config[key])
    return result

