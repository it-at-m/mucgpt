from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from mistral_common.protocol.instruct.request import ChatCompletionRequest

from core.token_counter import (
    TokenCounter,
    TokenCounterError,
    UnsupportedMessageTypeError,
    UnsupportedModelError,
)


class TestTokenCounter:
    def setup_method(self):
        self.token_counter = TokenCounter()
        self.test_messages = [
            SystemMessage(content="You are a helpful assistant"),
            HumanMessage(content="Hello, how are you?"),
            AIMessage(content="I'm doing well, thank you for asking!"),
        ]

    def test_unsupported_model(self):
        with pytest.raises(UnsupportedModelError):
            self.token_counter.num_tokens_from_messages(self.test_messages, "")

        with pytest.raises(UnsupportedModelError):
            self.token_counter.num_tokens_from_messages(self.test_messages, None)

        with pytest.raises(UnsupportedModelError):
            self.token_counter.num_tokens_from_messages(self.test_messages, 123)

        with pytest.raises(UnsupportedModelError):
            self.token_counter.num_tokens_from_messages(
                self.test_messages, "unknown-model"
            )

    def test_unsupported_message_type(self):
        # Create a custom message type not in the MESSAGE_TYPE_MAP
        class CustomMessage(HumanMessage):
            type: str = "custom"

        messages = [CustomMessage(content="This is a custom message")]

        with pytest.raises(UnsupportedMessageTypeError):
            self.token_counter.num_tokens_from_messages(messages, "gpt-4")

    @patch("core.token_counter.tiktoken")
    def test_openai_gpt4_token_counting(self, mock_tiktoken):
        # Setup mock encoding
        mock_encoding = MagicMock()
        mock_encoding.encode.side_effect = lambda text: [
            i for i in range(len(text))
        ]  # Each char is a token for simplicity
        mock_tiktoken.encoding_for_model.return_value = mock_encoding

        # Test GPT-4 token counting
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "gpt-4"
        )

        # Verify the encoding was called with the correct model
        mock_tiktoken.encoding_for_model.assert_called_once_with("gpt-4")

        # Each message has 3 tokens overhead, plus the encoded length of role and content
        # Plus 3 for reply priming
        expected_tokens = (
            3  # System message overhead
            + len("system")  # Role token count
            + len("You are a helpful assistant")  # Content token count
            + 3  # Human message overhead
            + len("user")  # Role token count
            + len("Hello, how are you?")  # Content token count
            + 3  # AI message overhead
            + len("assistant")  # Role token count
            + len("I'm doing well, thank you for asking!")  # Content token count
            + 3  # Reply priming
        )

        assert tokens == expected_tokens

    @patch("core.token_counter.tiktoken")
    def test_openai_gpt35_token_counting(self, mock_tiktoken):
        # Setup mock encoding
        mock_encoding = MagicMock()
        mock_encoding.encode.side_effect = lambda text: [i for i in range(len(text))]
        mock_tiktoken.encoding_for_model.return_value = mock_encoding

        # Test GPT-3.5 token counting
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "gpt-3.5-turbo"
        )

        # Verify the encoding was called with the correct model
        mock_tiktoken.encoding_for_model.assert_called_once_with("gpt-3.5-turbo")

        # Same logic as the GPT-4 test
        expected_tokens = (
            3
            + len("system")
            + len("You are a helpful assistant")
            + 3
            + len("user")
            + len("Hello, how are you?")
            + 3
            + len("assistant")
            + len("I'm doing well, thank you for asking!")
            + 3  # Reply priming
        )

        assert tokens == expected_tokens

    @patch("core.token_counter.tiktoken")
    def test_openai_gpt35_turbo_0301(self, mock_tiktoken):
        # Setup mock encoding
        mock_encoding = MagicMock()
        mock_encoding.encode.side_effect = lambda text: [i for i in range(len(text))]
        mock_tiktoken.encoding_for_model.return_value = mock_encoding

        # Test GPT-3.5-turbo-0301 token counting (has 4 tokens per message)
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "gpt-3.5-turbo-0301"
        )

        # Tokens per message is 4 for this specific model
        expected_tokens = (
            4
            + len("system")
            + len("You are a helpful assistant")
            + 4
            + len("user")
            + len("Hello, how are you?")
            + 4
            + len("assistant")
            + len("I'm doing well, thank you for asking!")
            + 3  # Reply priming
        )

        assert tokens == expected_tokens

    @patch("core.token_counter.tiktoken")
    def test_openai_fallback_encoding(self, mock_tiktoken):
        # Simulate model not found
        mock_tiktoken.encoding_for_model.side_effect = KeyError("Model not found")

        # Setup mock fallback encoding
        mock_encoding = MagicMock()
        mock_encoding.encode.side_effect = lambda text: [i for i in range(len(text))]
        mock_tiktoken.get_encoding.return_value = mock_encoding

        # Test fallback to cl100k_base
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "gpt-4-custom"
        )

        # Verify fallback encoding was used
        mock_tiktoken.get_encoding.assert_called_once_with("cl100k_base")

        # GPT-4 family uses 3 tokens per message
        expected_tokens = (
            3
            + len("system")
            + len("You are a helpful assistant")
            + 3
            + len("user")
            + len("Hello, how are you?")
            + 3
            + len("assistant")
            + len("I'm doing well, thank you for asking!")
            + 3  # Reply priming
        )

        assert tokens == expected_tokens

    @patch("core.token_counter.MistralTokenizer")
    def test_mistral_token_counting(self, mock_mistral_tokenizer):
        # Setup mock Mistral tokenizer
        mock_tokenizer = MagicMock()
        mock_mistral_tokenizer.from_model.return_value = mock_tokenizer

        # Mock the encode_chat_completion method
        mock_tokenized = MagicMock()
        mock_tokenized.tokens = [i for i in range(50)]  # 50 tokens
        mock_tokenizer.encode_chat_completion.return_value = mock_tokenized

        # Test Mistral token counting
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "mistral-medium"
        )

        # Verify the tokenizer was created with the correct model
        mock_mistral_tokenizer.from_model.assert_called_once_with("mistral-medium")

        # Verify encode_chat_completion was called with ChatCompletionRequest
        mock_tokenizer.encode_chat_completion.assert_called_once()
        args = mock_tokenizer.encode_chat_completion.call_args[0][0]
        assert isinstance(args, ChatCompletionRequest)

        # Verify we got the correct number of tokens
        assert tokens == 50

    @patch("core.token_counter.MistralTokenizer")
    def test_mistral_large_token_counting(self, mock_mistral_tokenizer):
        # Setup mock Mistral tokenizer for mistral-large-2407
        mock_tokenizer = MagicMock()
        mock_mistral_tokenizer.v3.return_value = mock_tokenizer

        # Mock the encode_chat_completion method
        mock_tokenized = MagicMock()
        mock_tokenized.tokens = [i for i in range(75)]  # 75 tokens
        mock_tokenizer.encode_chat_completion.return_value = mock_tokenized

        # Test Mistral Large token counting
        tokens = self.token_counter.num_tokens_from_messages(
            self.test_messages, "mistral-large-2407"
        )

        # Verify the v3 tokenizer was used
        mock_mistral_tokenizer.v3.assert_called_once()

        # Verify encode_chat_completion was called
        mock_tokenizer.encode_chat_completion.assert_called_once()

        # Verify we got the correct number of tokens
        assert tokens == 75

    @patch("core.token_counter.MistralTokenizer")
    def test_mistral_tokenizer_error(self, mock_mistral_tokenizer):
        # Simulate error in creating tokenizer
        mock_mistral_tokenizer.from_model.side_effect = Exception(
            "Failed to create tokenizer"
        )

        with pytest.raises(UnsupportedModelError):
            self.token_counter.num_tokens_from_messages(
                self.test_messages, "mistral-small"
            )

    @patch("core.token_counter.MistralTokenizer")
    def test_mistral_encoding_error(self, mock_mistral_tokenizer):
        # Setup mock tokenizer but make encode_chat_completion fail
        mock_tokenizer = MagicMock()
        mock_mistral_tokenizer.from_model.return_value = mock_tokenizer
        mock_tokenizer.encode_chat_completion.side_effect = Exception(
            "Failed to encode"
        )

        with pytest.raises(TokenCounterError):
            self.token_counter.num_tokens_from_messages(
                self.test_messages, "mistral-medium"
            )
