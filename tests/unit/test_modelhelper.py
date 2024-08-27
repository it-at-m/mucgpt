import unittest

import pytest

from core.modelhelper import num_tokens_from_messages, num_tokens_from_openai_model, num_tokens_from_mistral_model
from langchain_core.messages.base import BaseMessage

class Test_Modelhelper(unittest.TestCase):

    def setUp(self):
        # Set up common test variables
        self.messages = [
            BaseMessage(type="system", content="System message."),
            BaseMessage(type="ai", content="I am fine, thank you."),
            BaseMessage(type="human", content="Hello, how are you?"),
            
           
        ]
        self.model_openai = "gpt-3.5-turbo-0613"
        self.model_mistral = "mistral-large-2407"


    @pytest.mark.asyncio    
    @pytest.mark.unit  
    def test_num_tokens_from_messages_openai(self):
        assert num_tokens_from_messages(self.messages, self.model_openai) == 31
    
    @pytest.mark.asyncio    
    @pytest.mark.unit  
    def test_num_tokens_from_messages_mistral(self):
        assert num_tokens_from_messages(self.messages, self.model_mistral) == 24
    
    @pytest.mark.asyncio    
    @pytest.mark.unit  
    def test_num_tokens_from_messages_invalid_model(self):
        with self.assertRaises(NotImplementedError):
            num_tokens_from_messages(self.messages, "invalid-model")

    @pytest.mark.asyncio    
    @pytest.mark.unit  
    def test_num_tokens_from_mistral_model_invalid_message_type(self):
        invalid_messages = [BaseMessage(type="unknown", content="Test")]
        with self.assertRaises(NotImplementedError):
            num_tokens_from_mistral_model(invalid_messages, self.model_mistral)

    @pytest.mark.asyncio    
    @pytest.mark.unit  
    def test_num_tokens_from_openai_model_invalid_message_type(self):
        invalid_messages = [BaseMessage(type="unknown", content="Test")]
        with self.assertRaises(NotImplementedError):
            num_tokens_from_openai_model(invalid_messages, self.model_openai)

    