import logging
from typing import cast

from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    register_harness_profile,
)
from deepagents.backends import StateBackend
from deepagents.middleware import SummarizationMiddleware
from langchain.agents.middleware import TodoListMiddleware, ToolCallLimitMiddleware
from langchain.agents.middleware.types import AgentMiddleware

from config.model_provider import ModelRegistry
from config.settings import ModelsConfig

DEEP_AGENT_BUILTIN_TOOLS = frozenset(
    {
        "write_todos",
        "ls",
        "read_file",
        "write_file",
        "edit_file",
        "delete",
        "glob",
        "grep",
        "execute",
        "task",
    }
)

logger = logging.getLogger(__name__)


class ProfileSummarizationMiddleware(SummarizationMiddleware):
    """Profile-configured replacement for Deep Agents' default summarizer."""


def _set_extra_middleware_for_model(model_config: ModelsConfig) -> tuple[AgentMiddleware, ...]:
    """Determine extra middleware to apply for a given model configuration."""
    enabled_tools = model_config.deep_agent.enabled_builtin_tools
    if not enabled_tools:
        return ()

    summarization_middleware = ProfileSummarizationMiddleware(
        model=ModelRegistry.get_model(), # default (small) model, will be called every time once the message history reaches the trigger threshold (with current setup)
        backend=StateBackend(),  # Use default backend (per chat session); exchangeable with a custom backend after chats are backend persistent
        trigger=("fraction", 0.8),  # Trigger summarization when 80% of the token limit is reached
        keep=("messages", 10),  # Keep the last 10 messages in the conversation
    ) if model_config.deep_agent.enable_summarization and "write_file" in enabled_tools and "read_file" in enabled_tools and "edit_file" in enabled_tools else None

    todo_middleware = TodoListMiddleware() if "write_todos" in enabled_tools else None

    call_limit_middleware = []
    retrieval_keywords = ("read", "retrieve", "retrieval", "fetch", "get")
    for name in enabled_tools:
        normalized_name = name.lower()
        if any(keyword in normalized_name for keyword in retrieval_keywords):
            # Limit context retrieval tools to 2 calls per run
            call_limit_middleware.append(
                ToolCallLimitMiddleware(tool_name=name, run_limit=2)
            )

    extra_middleware = cast(
        tuple[AgentMiddleware, ...],
        tuple(
            middleware
            for middleware in (
                summarization_middleware,
                todo_middleware,
                *call_limit_middleware,
            )
            if middleware is not None
        ),
    )
    return extra_middleware

def register_model_harness_profile(model_config: ModelsConfig) -> None:
    """Register enabled Deep Agents built-ins for one configured model."""
    extra_middleware = _set_extra_middleware_for_model(model_config)
    # in future this could be extended to introduce different default system prompts for different models,
    # or to append model-specific system prompt suffixes to the default system prompt, or to introduce model-specific middleware, etc.
    # as per documentation, this is sets the default harness profile for the given model type and name, which can NOT be overridden by a middleware override.
    enabled_tools = model_config.deep_agent.enabled_builtin_tools
    register_harness_profile(
        f"{model_config.type.lower()}:{model_config.llm_name}",
        HarnessProfile(
            excluded_tools=DEEP_AGENT_BUILTIN_TOOLS - enabled_tools,
            extra_middleware=extra_middleware,
            # Remove only Deep Agents' built-in summarization middleware implementation. 
            # The profiles subclass remains, retaining its model, trigger, and keep settings.
            excluded_middleware=(
                frozenset({SummarizationMiddleware})
                if any(
                    isinstance(middleware, ProfileSummarizationMiddleware)
                    for middleware in extra_middleware
                )
                or not model_config.deep_agent.enable_summarization
                else frozenset()
            ),
            general_purpose_subagent=GeneralPurposeSubagentProfile(
                enabled="task" in enabled_tools and model_config.deep_agent.enable_subagents # task tool is required for subagents
            ),
        ),
    )
    logger.debug(
        "Registered Deep Agents profile %s:%s with enabled built-ins %s; ",
        model_config.type.lower(),
        model_config.llm_name,
        sorted(enabled_tools),
    )
