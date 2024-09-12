import json

from core.types.Config import Config


class ConfigHelper:
    """Loads an available configuration.
    """
    def __init__(self, env_config: str, base_config: str = "base.json"):
        self.base_config = base_config
        self.env_config = env_config
    def loadData(self) -> Config:
        with open(self.env_config) as f:
            env_config = json.load(f)
        with open(self.base_config) as f:
            base_config = json.load(f)
        return Config(version=base_config["version"], frontend=env_config["frontend"], backend=env_config["backend"])