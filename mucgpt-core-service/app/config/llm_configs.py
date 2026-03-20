from typing import NotRequired

from typing_extensions import TypedDict


class LlmConfigs(TypedDict, total=False):
    """Configuration helper class for langchain. A llm runnable can have this kind of parameters:
    llm.with_config(configurable=config)
    """

    llm: NotRequired[str]  # one of the SupportedModels
    llm_temperature: NotRequired[float]
    llm_streaming: NotRequired[bool]
    llm_callbacks: NotRequired[list]
