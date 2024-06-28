from typing import List

from typing_extensions import NotRequired, TypedDict


class LlmConfigs(TypedDict, total=False):
    """Configuration helper class for langchain. A llm runnable can have this kind of parameters:
    llm.with_config(configurable=config)
    """
    llm: NotRequired[str] # one of the SupportedModels
    llm_max_tokens: NotRequired[int]
    llm_temperature: NotRequired[float]
    llm_api_key: NotRequired[str]
    llm_streaming: NotRequired[bool]
    llm_callbacks: NotRequired[List]