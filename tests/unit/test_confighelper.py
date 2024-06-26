import unittest

import pytest

from core.confighelper import ConfigHelper
from typing import TypedDict


class Test_Confighelper(unittest.TestCase):
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_create(self):
        path=r"app\backend\ressources"
        env="dev"
        helper = ConfigHelper(path, env)
        self.assertEqual(helper.base_config_name, "base")
        self.assertEqual(helper.env, env)
        self.assertEqual(helper.base_path, path)
        helper = ConfigHelper(path, env, "basis")
        self.assertEqual(helper.base_config_name, "basis")
        self.assertEqual(helper.env, env)
        self.assertEqual(helper.base_path, path)


    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_loadData(self):
        path=r"app\\backend\\ressources\\"
        env="dev"
        helper = ConfigHelper(path, env)
        data = helper.loadData()
        self.assertIn("version", data)
        self.assertIn("frontend", data)
        self.assertIn("backend", data)