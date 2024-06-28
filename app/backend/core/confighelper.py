import json

from core.types.Config import Config, to_typed_config


class ConfigHelper:
    """Loads an available configuration.
    """
    def __init__(self, base_path: str, env: str, base_config_name: str = "base"):
        self.base_path = base_path
        self.base_config_name = base_config_name
        self.env = env
    def loadData(self) -> Config:
        with open(self.base_path + self.env + ".json") as f:
            env_config = json.load(f)
        with open(self.base_path + self.base_config_name + ".json") as f:
            base_config = json.load(f)
        result_dict =  dict(env_config,**base_config)
        return to_typed_config(result_dict)