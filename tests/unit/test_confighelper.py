import os
import unittest

import pytest

from core.confighelper import ConfigHelper


class Test_Confighelper(unittest.TestCase):
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_create(self):
        path = os.path.join('app', 'backend', 'ressources', '')
        path = os.path.abspath(path)
        assert os.path.exists(path), "File does not exist"
        path = path + "\\"
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
        path = os.path.join('app', 'backend', 'ressources', '')
        path = os.path.abspath(path)
        assert os.path.exists(path), "File does not exist"
        path = path + "\\"
        env="dev"
        helper = ConfigHelper(path, env)
        data = helper.loadData()
        self.assertIn("version", data)
        self.assertIn("frontend", data)
        self.assertIn("backend", data)
    
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_confighelper_loadData_fail(self):
        path = os.path.join('app', 'backend', 'ressources', '')
        path = os.path.abspath(path)
        assert os.path.exists(path), "File does not exist"
        path = path + "\\"
        env="super"
        filename = path + env + ".json"
        with open(filename, "w") as file:
            file.write('{"frontend": {"labels": {"env_name": "MUC tschibidi-C"},"alternative_logo": true}}')
        helper = ConfigHelper(path, env)
        self.assertEqual(helper.base_config_name, "base")
        self.assertEqual(helper.env, env)
        self.assertEqual(helper.base_path, path)
        self.assertRaises(ValueError, helper.loadData)
        os.remove(filename)
