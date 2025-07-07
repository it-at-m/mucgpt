from __future__ import annotations

import logging

import tiktoken
from langchain_core.messages.base import BaseMessage
from mistral_common.protocol.instruct.messages import (
    AssistantMessage,
    SystemMessage,
    UserMessage,
)
from mistral_common.protocol.instruct.request import ChatCompletionRequest
from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

# Default logger
default_logger = logging.getLogger(__name__)


class TokenCounterError(Exception):
    """Base exception class for token counting errors."""

    pass


class UnsupportedModelError(TokenCounterError):
    """Exception raised when an unsupported model is provided."""

    pass


class UnsupportedMessageTypeError(TokenCounterError):
    """Exception raised when an unsupported message type is provided."""

    pass


class TokenCounter:
    """A class to count tokens in messages for different LLM providers."""

    MESSAGE_TYPE_MAP = {
        "ai": ("assistant", AssistantMessage),
        "system": ("system", SystemMessage),
        "human": ("user", UserMessage),
    }

    def __init__(self, logger=None):
        """Initialize the TokenCounter with an optional logger.

        Args:
            logger: The logger to use. If None, uses the default logger.
        """
        self.logger = logger or default_logger

    def num_tokens_from_messages(self, messages: list[BaseMessage], model: str) -> int:
        """Return the number of tokens used by a list of messages.

        Args:
            messages: The list of messages.
            model: The model name.

        Returns:
            The number of tokens used by the messages.

        Raises:
            UnsupportedModelError: If the model is not supported.
        """
        if not model:
            raise UnsupportedModelError("Model name cannot be empty")

        if not isinstance(model, str):
            raise UnsupportedModelError(
                f"Model name must be a string, got {type(model)}"
            )

        if "gpt-" in model:
            return self._num_tokens_from_openai_model(messages=messages, model=model)
        if "mistral" in model:
            return self._num_tokens_from_mistral_model(messages=messages, model=model)

        self.logger.error(f"Unsupported model: {model}")
        raise UnsupportedModelError(
            f"No tokenizer for model '{model}' found. Currently only OpenAI and Mistral are supported."
        )

    def _get_message_type_mapping(self, message_type: str):
        """Return the message type mapping for a given message type.

        Args:
            message_type: The type of the message.

        Returns:
            A tuple containing the role name and message class.

        Raises:
            UnsupportedMessageTypeError: If the message type is not supported.
        """
        if message_type not in self.MESSAGE_TYPE_MAP:
            self.logger.error(f"Unsupported message type: {message_type}")
            raise UnsupportedMessageTypeError(
                f"Not implemented for the message type {message_type}"
            )
        return self.MESSAGE_TYPE_MAP[message_type]

    def _num_tokens_from_mistral_model(
        self, messages: list[BaseMessage], model: str
    ) -> int:
        """Return the number of tokens used by a list of messages for a given Mistral model.

        Args:
            messages: The list of messages.
            model: The model name.

        Returns:
            The number of tokens used by the messages.

        Raises:
            UnsupportedModelError: If the model is not supported by Mistral.
            UnsupportedMessageTypeError: If a message type is not supported.
        """
        # see which tokenizer for which model is needed, https://github.com/mistralai/mistral-common/blob/main/README.md
        try:
            tokenizer = (
                MistralTokenizer.v3()
                if model == "mistral-large-2407"
                else MistralTokenizer.from_model(model)
            )
        except Exception as e:
            self.logger.error(
                f"Error initializing Mistral tokenizer for model {model}: {str(e)}"
            )
            raise UnsupportedModelError(
                f"Failed to initialize Mistral tokenizer for model '{model}': {str(e)}"
            )

        try:
            mistral_messages = [
                self._get_message_type_mapping(msg.type)[1](content=msg.content)
                for msg in messages
            ]

            tokenized = tokenizer.encode_chat_completion(
                ChatCompletionRequest(messages=mistral_messages)
            )
            return len(tokenized.tokens)
        except UnsupportedMessageTypeError:
            # Re-raise message type errors
            raise
        except Exception as e:
            self.logger.error(
                f"Error counting tokens for Mistral model {model}: {str(e)}"
            )
            raise TokenCounterError(
                f"Failed to count tokens for Mistral model '{model}': {str(e)}"
            )

    def _num_tokens_from_openai_model(
        self, messages: list[BaseMessage], model: str
    ) -> int:
        """Return the number of tokens used by a list of messages for a given OpenAI model.

        Args:
            messages: The list of messages.
            model: The model name.

        Returns:
            The number of tokens used by the messages.

        Raises:
            UnsupportedModelError: If the model is not supported.
            UnsupportedMessageTypeError: If a message type is not supported.
            TokenCounterError: For any other token counting errors.
        """
        try:
            encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            self.logger.warning(f"Model {model} not found. Using cl100k_base encoding.")
            try:
                encoding = tiktoken.get_encoding("cl100k_base")
            except Exception as e:
                self.logger.error(f"Failed to get cl100k_base encoding: {str(e)}")
                raise TokenCounterError(
                    f"Failed to get encoding for model '{model}': {str(e)}"
                )

        try:
            if "gpt-3.5-turbo-0301" in model:
                tokens_per_message = 4
            elif "gpt-4" in model or "gpt-3.5" in model:
                tokens_per_message = 3
            else:
                self.logger.error(f"Unsupported OpenAI model: {model}")
                raise UnsupportedModelError(
                    f"Model '{model}' not implemented for token counting. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens."
                )

            num_tokens = 0
            for message in messages:
                num_tokens += tokens_per_message
                try:
                    role = self._get_message_type_mapping(message.type)[0]
                    num_tokens += len(encoding.encode(role))
                    if message.content:
                        num_tokens += len(encoding.encode(message.content))
                except UnsupportedMessageTypeError:
                    # Re-raise message type errors
                    raise
                except Exception as e:
                    self.logger.error(f"Error encoding message content: {str(e)}")
                    raise TokenCounterError(
                        f"Failed to encode message content: {str(e)}"
                    )

            num_tokens += 3  # every reply is primed with <|start|>assistant<|message|>
            return num_tokens

        except (UnsupportedModelError, UnsupportedMessageTypeError):
            # Re-raise specific errors
            raise
        except Exception as e:
            self.logger.error(
                f"Unexpected error counting tokens for OpenAI model {model}: {str(e)}"
            )
            raise TokenCounterError(
                f"Unexpected error counting tokens for OpenAI model '{model}': {str(e)}"
            )
