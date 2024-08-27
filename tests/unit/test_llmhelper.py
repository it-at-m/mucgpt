import unittest

import pytest
from langchain_core.runnables.base import RunnableSerializable

from core.llmhelper import getModel


class Test_LLMhelper(unittest.TestCase):

    def setUp(self):
        self.model1 = {
                "type": "OPENAI",
                "model_name": "model1",
                "endpoint": "TODO",
                "api_key": "TODO",
                "max_tokens": 128000
            }
        self.model2 ={
                "type": "OPENAI",
                "model_name": "model2",
                "endpoint": "TODO",
                "api_key": "TODO",
                "max_tokens": 128000
            }

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_getModel_returns_llm(self):
        
    
        model = getModel(models=[self.model1, self.model2],
                         max_tokens=10,
                         n=1,
                         temperature=0.5,
                         streaming=True)
        self.assertIsInstance(model, RunnableSerializable)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_configurable_fields(self):
        model = getModel(models=[self.model1, self.model2],
                         max_tokens=10,
                         n=1,
                        temperature=0.5,
                         streaming=True)
        self.assertIn("temperature", model.fields)
        self.assertIn("max_tokens", model.fields)
        self.assertIn("streaming", model.fields)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_configurable_alternatives(self):
        model = getModel(models=[self.model1, self.model2],
                         max_tokens=10,
                         n=1,
                         temperature=0.5,
                         streaming=True)
        self.assertIn("fake", model.alternatives)

    @pytest.mark.asyncio    
    @pytest.mark.unit    
    def test_getModel_fake_llm(self):
        model = getModel(models=[self.model1, self.model2],
                         max_tokens=10,
                         n=1,
                         temperature=0.5,
                         streaming=True)
        self.assertEqual(model.alternatives["fake"].responses, ["Hi diggi"])