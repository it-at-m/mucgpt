import unittest

import pytest

from core.confighelper import ConfigHelper
import os


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
    
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_loadData_fail(self):
        filename = "app\\backend\\ressources\\super.json"
        with open(filename, "w") as file:
            file.write('{"frontend": {"labels": {"env_name": "MUC tschibidi-C"},"alternative_logo": true}}')
        path=r"app\\backend\\ressources\\"
        env="super"
        helper = ConfigHelper(path, env)
        self.assertEqual(helper.base_config_name, "base")
        self.assertEqual(helper.env, env)
        self.assertEqual(helper.base_path, path)
        self.assertRaises(ValueError, helper.loadData)
        os.remove(filename)
