import unittest

import pytest

from core.modelhelper import get_token_limit, num_tokens_from_messages


class Test_Modelhelper(unittest.TestCase):
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_get_token_limit(self):
        self.assertEqual(get_token_limit("gpt-35-turbo"), 4000)
        self.assertEqual(get_token_limit("gpt-3.5-turbo"), 4000)
        self.assertEqual(get_token_limit("gpt-35-turbo-16k"), 16000)
        self.assertEqual(get_token_limit("gpt-3.5-turbo-16k"), 16000)
        self.assertEqual(get_token_limit("gpt-4"), 8100)
        self.assertEqual(get_token_limit("gpt-4-32k"), 32000)
        self.assertRaises(ValueError, get_token_limit, "gpt-2")

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_num_tokens_from_messages(self):
        messages = [
            {"user": "Hello, I have a problem with my computer.", "bot": "Hi there! What seems to be the issue?"},
            {"user": "My computer won't turn on.", "bot": "Okay, let's try a few troubleshooting steps. Have you checked to make sure it's plugged in and the power outlet?"}]
        self.assertEqual(num_tokens_from_messages(messages,"gpt-35-turbo" ), 64)
        self.assertRaises(ValueError,num_tokens_from_messages,messages,"" )
        self.assertRaises(ValueError,num_tokens_from_messages,messages,"gpt-2" )

    