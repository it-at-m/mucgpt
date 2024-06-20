from typing_extensions import List, NotRequired, TypedDict


class LlmConfigs(TypedDict, total=False):
    llm: NotRequired[str] # one of the SupportedModels
    llm_max_tokens: NotRequired[int]
    llm_temperature: NotRequired[float]
    llm_api_key: NotRequired[str]
    llm_streaming: NotRequired[bool]
    llm_callbacks: NotRequired[List]