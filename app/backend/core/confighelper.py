import json

class ConfigHelper:
    def __init__(self, base_path: str, env: str, base_config_name: str = "base"):
        self.base_path = base_path
        self.base_config_name = base_config_name
        self.env = env
    def loadData(self):
        with open(self.base_path + self.env + ".json", 'r') as f:
            env_config = json.load(f)
        with open(self.base_path + self.base_config_name + ".json", 'r') as f:
            base_config = json.load(f)
        return dict(env_config,**base_config)