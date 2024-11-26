import unittest

import pytest

from core.confighelper import ConfigHelper
from core.types.Config import BackendConfig, Config, FrontendConfig


class Test_Confighelper(unittest.TestCase):
    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_confighelper_loadData(self):
        helper = ConfigHelper()
        data = helper.loadData()
        self.assertEqual(FrontendConfig, type(data.frontend))
        self.assertEqual(BackendConfig, type(data.backend))
        self.assertEqual(str, type(data.version))
        self.assertEqual(Config, type(data))
