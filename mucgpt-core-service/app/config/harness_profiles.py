import logging
from typing import Any

from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    register_harness_profile,
)
from deepagents.backends import StateBackend
from deepagents.middleware import SummarizationMiddleware
from langchain.agents.middleware import TodoListMiddleware
from langchain.agents.middleware.types import AgentMiddleware

from agent.tool_limits import ToolRunLimitMiddleware
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

# Built-ins that are agent plumbing (planning, scratch files) rather than work the user
# cares about; the frontend leaves them out of the activity display. Sub-agents ("task")
# and "execute" stay visible if ever used. canvas_read is a local tool but a cheap safety
# net, so it is hidden from the activity UI the same way.
DEEP_AGENT_INTERNAL_TOOLS = (DEEP_AGENT_BUILTIN_TOOLS - {"task", "execute"}) | {
    "canvas_read"
}

logger = logging.getLogger(__name__)


class ProfileSummarizationMiddleware(SummarizationMiddleware):
    """Profile-configured replacement for Deep Agents' default summarizer."""


def _set_extra_middleware_for_model(
    model_config: ModelsConfig,
) -> tuple[AgentMiddleware[Any, Any, Any], ...]:
    """Determine extra middleware to apply for a given model configuration."""
    enabled_tools = model_config.deep_agent.enabled_builtin_tools

    # Archiving uses the scratch backend directly, not model-exposed write tools.
    middleware: list[AgentMiddleware[Any, Any, Any]] = []
    if model_config.deep_agent.enable_summarization:
        middleware.append(
            ProfileSummarizationMiddleware(
                model=ModelRegistry.get_model(),
                backend=StateBackend(),
                trigger=("fraction", 0.8),
                keep=("messages", 10),
            )
        )
    if "write_todos" in enabled_tools:
        middleware.append(TodoListMiddleware())
    middleware.extend(
        ToolRunLimitMiddleware(tool_name=name, run_limit=limit)
        for name, limit in sorted(
            model_config.deep_agent.builtin_tool_run_limits.items()
        )
        if name in enabled_tools and limit is not None
    )
    return tuple(middleware)


def register_model_harness_profile(model_config: ModelsConfig) -> None:
    """Register enabled Deep Agents built-ins for one configured model."""
    extra_middleware = _set_extra_middleware_for_model(model_config)
    # in future this could be extended to introduce different default system prompts for different models,
    # or to append model-specific system prompt suffixes to the default system prompt, or to introduce model-specific middleware, etc.
    # as per documentation, this is sets the default harness profile for the given model type and name, which can NOT be overridden by a middleware override.
    enabled_tools = model_config.deep_agent.enabled_builtin_tools
    register_harness_profile(
        f"{model_config.type.lower()}:{model_config.id}",
        HarnessProfile(
            excluded_tools=DEEP_AGENT_BUILTIN_TOOLS - enabled_tools,
            extra_middleware=extra_middleware,
            # Either use our configured subclass or disable summarization entirely.
            excluded_middleware=frozenset({SummarizationMiddleware}),
            general_purpose_subagent=GeneralPurposeSubagentProfile(
                enabled="task" in enabled_tools
                and model_config.deep_agent.enable_subagents  # task tool is required for subagents
            ),
        ),
    )
    logger.debug(
        "Registered Deep Agents profile %s:%s with enabled built-ins %s; ",
        model_config.type.lower(),
        model_config.id,
        sorted(enabled_tools),
    )
