import os
import unittest

import pytest

from core.confighelper import ConfigHelper


class Test_Confighelper(unittest.TestCase):
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_loadData(self):
        env_path = os.path.join('config', 'default.json')
        env_path = os.path.abspath(env_path)
        assert os.path.exists(env_path), "File does not exist"
        base_path = os.path.join('config', 'base.json')
        base_path = os.path.abspath(base_path)
        assert os.path.exists(base_path), "File does not exist"
        helper = ConfigHelper(env_config=env_path, base_config=base_path)
        data = helper.loadData()
        self.assertIn("frontend", data)
        self.assertIn("backend", data)
        self.assertIn("version", data)
