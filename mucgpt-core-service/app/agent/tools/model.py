from copy import deepcopy
from typing import cast

from langchain.tools import ToolRuntime
from langchain_core.runnables.base import RunnableSerializable
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from agent.middleware import RequestContext
from config.model_provider import ModelRegistry


def configure_tool_model(
    model: RunnableSerializable, tool_name: str, runtime: ToolRuntime[RequestContext]
) -> RunnableSerializable:
    """Apply the current chat's settings to a local tool's nested model calls."""
    context = runtime.context or RequestContext()
    settings_model: ChatOpenAI | AzureChatOpenAI | RunnableSerializable = model
    if context.model_name is not None:
        settings_model = ModelRegistry.get_model(context.model_name)

    extra_body = deepcopy(context.extra_body or {})
    metadata = extra_body.setdefault("metadata", {})
    metadata["tags"] = [
        *metadata.get("tags", []),
        f"MUCGPT_TOOL_NAME:{tool_name}",
    ]
    settings = {
        "stream": True,
        "temperature": context.temperature,
        "reasoning_effort": context.reasoning_effort,
        "extra_body": extra_body,
    }
    if context.user is not None:
        settings["user"] = context.user

    # Both chat stream adapters already filter chunks tagged as internal.
    # The stubs of `bind`/`with_config` return the broad `Runnable` type while
    # the runtime value is a `RunnableBinding` (a `RunnableSerializable`).
    return cast(
        "RunnableSerializable",
        settings_model.bind(
            **ModelRegistry.normalize_model_settings(settings_model, settings)
        ).with_config(tags=["internal"]),
    )
