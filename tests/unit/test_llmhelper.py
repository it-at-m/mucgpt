import unittest

import pytest

from core.llmhelper import getModel
from langchain_core.runnables.base import RunnableSerializable


class Test_LLMhelper(unittest.TestCase):

    def setUp(self):
        self.api_key = "test_api_key"
        self.api_base = "test_api_base"
        self.api_version = "test_api_version"
        self.api_type = "test_api_type"

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_getModel_returns_llm(self):
        model = getModel(chatgpt_model="test_model",
                         max_tokens=10,
                         n=1,
                         api_key=self.api_key,
                         api_base=self.api_base,
                         api_version=self.api_version,
                         api_type=self.api_type,
                         temperature=0.5,
                         streaming=True)
        self.assertIsInstance(model, RunnableSerializable)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_configurable_fields(self):
        model = getModel(chatgpt_model="test_model",
                         max_tokens=10,
                         n=1,
                         api_key=self.api_key,
                         api_base=self.api_base,
                         api_version=self.api_version,
                         api_type=self.api_type,
                         temperature=0.5,
                         streaming=True)
        self.assertIn("temperature", model.fields)
        self.assertIn("max_tokens", model.fields)
        self.assertIn("openai_api_key", model.fields)
        self.assertIn("streaming", model.fields)
        self.assertIn("callbacks", model.fields)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_configurable_alternatives(self):
        model = getModel(chatgpt_model="test_model",
                         max_tokens=10,
                         n=1,
                         api_key=self.api_key,
                         api_base=self.api_base,
                         api_version=self.api_version,
                         api_type=self.api_type,
                         temperature=0.5,
                         streaming=True)
        self.assertIn("fake", model.alternatives)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_fake_llm(self):
        model = getModel(chatgpt_model="test_model",
                         max_tokens=10,
                         n=1,
                         api_key=self.api_key,
                         api_base=self.api_base,
                         api_version=self.api_version,
                         api_type=self.api_type,
                         temperature=0.5,
                         streaming=True)
        print(model.alternatives["fake"])
        self.assertEqual(model.alternatives["fake"].responses, ["Hi diggi"])