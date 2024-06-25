from __future__ import annotations

import tiktoken

MODELS_2_TOKEN_LIMITS = {
    "gpt-35-turbo": 4000,
    "gpt-3.5-turbo": 4000,
    "gpt-35-turbo-16k": 16000,
    "gpt-3.5-turbo-16k": 16000,
    "gpt-4": 8100,
    "gpt-4-32k": 32000
}

AOAI_2_OAI = {
    "gpt-35-turbo": "gpt-3.5-turbo",
    "gpt-35-turbo-16k": "gpt-3.5-turbo-16k"
}


def get_token_limit(model_id: str) -> int:
    """returns the token limit for a given model

    Args:
        model_id (str): id of the model

    Raises:
        ValueError: if the model is not available

    Returns:
        int: the token limit of the model
    """
    if model_id not in MODELS_2_TOKEN_LIMITS:
        raise ValueError("Expected model gpt-35-turbo and above")
    return MODELS_2_TOKEN_LIMITS[model_id]


def num_tokens_from_messages(messages: 'list[dict[str, str]]', model: str) -> int:
    """  Calculate the number of tokens required to encode a list of messages

    Args:
        messages (list[dict[str, str]]): list of messages
        model (str): for which model

    Returns:
        int: The total number of tokens required to encode the message.
    """
    num_tokens = 0
    for conversation in messages:
        if("user" in conversation and conversation["user"]):
            userMsg = conversation["user"]
            num_tokens += num_tokens_from_message(message= userMsg, model=model)
        if("bot" in conversation and conversation["bot"]):
            aiMsg = conversation["bot"]
            num_tokens += num_tokens_from_message(message= aiMsg, model=model)
    return num_tokens
           
def num_tokens_from_message(message: str, model: str, token_per_message: int = 3) -> int:
    """Calculate the number of tokens required to encode a message.
    
    Args:
        message (str): The message to encode
        model (str): The name of the model to use for encoding.
        token_per_message (number): offset per message
    Returns:
        int: The total number of tokens required to encode the message.
    Example:
        message = {'role': 'user', 'content': 'Hello, how are you?'}
        model = 'gpt-3.5-turbo'
        num_tokens_from_messages(message, model)
        output: 11
    """
    encoding = tiktoken.encoding_for_model(get_oai_chatmodel_tiktok(model))
    num_tokens = token_per_message  # For "role" and "content" keys
    num_tokens += len(encoding.encode(message))
    return num_tokens


def get_oai_chatmodel_tiktok(aoaimodel: str) -> str:
    message = "Expected Azure OpenAI ChatGPT model name"
    if aoaimodel == "" or aoaimodel is None:
        raise ValueError(message)
    if aoaimodel not in AOAI_2_OAI and aoaimodel not in MODELS_2_TOKEN_LIMITS:
        raise ValueError(message)
    return AOAI_2_OAI.get(aoaimodel) or aoaimodel