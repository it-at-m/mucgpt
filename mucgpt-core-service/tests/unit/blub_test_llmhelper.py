import unittest

import pytest
from langchain_core.runnables.base import RunnableSerializable

from core.llmhelper import ModelsConfigurationException, getModel
from core.types.Config import ModelsConfig


class Test_LLMhelper(unittest.TestCase):
    def setUp(self):
        self.model1 = ModelsConfig(
            type="OPENAI",
            llm_name="model1",
            endpoint="https://myfakeendpoint.com/",
            api_key="TODO",
            max_input_tokens=128000,
            max_output_tokens=8192,
            description="",
        )
        self.model2 = ModelsConfig(
            type="AZURE",
            deployment="model2",
            llm_name="model2",
            api_version="preview",
            endpoint="https://myfakeendpoint.com/",
            api_key="TODO",
            max_input_tokens=128000,
            max_output_tokens=8192,
            description="",
        )
        self.model3 = ModelsConfig(
            type="OPENAI1",
            llm_name="model1",
            endpoint="https://myfakeendpoint.com/",
            api_key="TODO",
            max_input_tokens=128000,
            max_output_tokens=8192,
            description="",
        )

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_returns_llm(self):
        model = getModel(
            models=[self.model1, self.model2],
            max_output_tokens=10,
            n=1,
            temperature=0.5,
            streaming=True,
        )
        self.assertIsInstance(model, RunnableSerializable)

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_wrong_type(self):
        with self.assertRaises(ModelsConfigurationException):
            getModel(
                models=[self.model3],
                max_output_tokens=10,
                n=1,
                temperature=0.5,
                streaming=True,
            )

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_azure_first(self):
        model = getModel(
            models=[self.model2, self.model1],
            max_output_tokens=10,
            n=1,
            temperature=0.5,
            streaming=True,
        )
        self.assertIsInstance(model, RunnableSerializable)

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_no_model(self):
        with self.assertRaises(ModelsConfigurationException):
            getModel(
                models=[], max_output_tokens=10, n=1, temperature=0.5, streaming=True
            )

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_configurable_fields(self):
        model = getModel(
            models=[self.model1, self.model2],
            max_output_tokens=10,
            n=1,
            temperature=0.5,
            streaming=True,
        )
        self.assertIn("temperature", model.fields)
        self.assertIn("max_tokens", model.fields)
        self.assertIn("streaming", model.fields)

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_configurable_alternatives(self):
        model = getModel(
            models=[self.model1, self.model2],
            max_output_tokens=10,
            n=1,
            temperature=0.5,
            streaming=True,
        )
        self.assertIn("fake", model.alternatives)

    @pytest.mark.asyncio
    @pytest.mark.unit
    def test_getModel_fake_llm(self):
        model = getModel(
            models=[self.model1, self.model2],
            max_output_tokens=10,
            n=1,
            temperature=0.5,
            streaming=True,
        )
        self.assertEqual(model.alternatives["fake"].responses, ["Hi diggi"])
