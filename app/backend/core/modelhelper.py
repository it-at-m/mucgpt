from __future__ import annotations
from typing import List

import tiktoken
from langchain_core.messages.base import BaseMessage
from mistral_common.protocol.instruct.messages import (
    UserMessage, SystemMessage, AssistantMessage
)
from mistral_common.protocol.instruct.request import ChatCompletionRequest
from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

def num_tokens_from_messages(messages: List[BaseMessage], model: str):
    """Return the number of tokens used by a list of messages."""
    if("gpt-" in model):
        return num_tokens_from_openai_model(messages=messages, model=model)
    elif("mistral" in model):
        return num_tokens_from_mistral_model(messages=messages, model=model)
    else:
        raise NotImplementedError(
            f"""No tokenizer for model found. currently only openai and mistral are supported."""
        )
def num_tokens_from_mistral_model(messages: List[BaseMessage], model: str):
    """Return the number of tokens used by a list of messages for a given mistral model."""
    num_tokens = 0
    # see which tokenizer for which model is needed, https://github.com/mistralai/mistral-common/blob/main/README.md
    if(model == "mistral-large-2407" ):
        tokenizer = MistralTokenizer.v3()
    else:
        tokenizer = MistralTokenizer.from_model(model) 
    # convert langchain msgs to mistral format
    mistral_messages = []
    for message in messages:
        if(message.type =="ai"):
            mistral_messages.append(AssistantMessage(content=message.content))
        elif(message.type == "system"):
            mistral_messages.append(SystemMessage(content=message.content))
        elif(message.type == "human"):
            mistral_messages.append(UserMessage(content=message.content))
        else:
            raise NotImplementedError(
                    f"""Not implemented for the message type {message.type}"""
                )
    tokenized = tokenizer.encode_chat_completion(
                ChatCompletionRequest(messages=mistral_messages))
    return len(tokenized.tokens)

def num_tokens_from_openai_model(messages: List[BaseMessage], model: str):
    """Return the number of tokens used by a list of messages for a given openai model."""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        print("Warning: model not found. Using cl100k_base encoding.")
        encoding = tiktoken.get_encoding("cl100k_base")
    if model in {
        "gpt-3.5-turbo-0613",
        "gpt-3.5-turbo-16k-0613",
        "gpt-4-0314",
        "gpt-4-32k-0314",
        "gpt-4-0613",
        "gpt-4-32k-0613",
        "gpt-4-turbo",
        "gpt-4-turbo-2024-04-09",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4o-2024-05-13",
        }:
        tokens_per_message = 3
        tokens_per_name = 1
    elif model == "gpt-3.5-turbo-0301":
        tokens_per_message = 4  # every message follows <|start|>{role/name}\n{content}<|end|>\n
        tokens_per_name = -1  # if there's a name, the role is omitted
    elif "gpt-3.5-turbo" in model:
        print("Warning: gpt-3.5-turbo may update over time. Returning num tokens assuming gpt-3.5-turbo-0613.")
        return num_tokens_from_messages(messages, model="gpt-3.5-turbo-0613")
    elif "gpt-4o" in model:
        print(
            "Warning: gpt-4o may update over time. Returning num tokens assuming gpt-4o-2024-05-13.")
        return num_tokens_from_messages(messages, model="gpt-4o-2024-05-13")
    elif "gpt-4" in model:
        print("Warning: gpt-4 may update over time. Returning num tokens assuming gpt-4-0613.")
        return num_tokens_from_messages(messages, model="gpt-4-0613")
    else:
        raise NotImplementedError(
            f"""num_tokens_from_messages() is not implemented for model {model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens."""
        )
    num_tokens = 0
    for message in messages:
        num_tokens += tokens_per_message
        if(message.type):
           role = ""
           if(message.type =="ai"):
               role = "assistant"
           elif(message.type == "system"):
               role = "system"
           elif(message.type == "human"):
               role = "user"
           else:
            raise NotImplementedError(
                f"""Not implemented for the message type {message.type}"""
            )
           num_tokens += len(encoding.encode(role))
        if(message.content):
           num_tokens += len(encoding.encode(message.content))
    num_tokens += 3  # every reply is primed with <|start|>assistant<|message|>
    return num_tokens