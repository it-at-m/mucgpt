from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, cast

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends.protocol import BackendProtocol
from langchain.agents.middleware import InterruptOnConfig
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import merge_configs
from langchain_core.tools.base import BaseTool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import Command, Durability

from agent.middleware import (
    TOOL_STATUS_ARG,
    ContextMiddleware,
    RequestContext,
    TokenUsage,
    TokenUsageMiddleware,
    ToolErrorMiddleware,
    ToolStatusMiddleware,
)
from agent.state_models.default_state import DefaultAgentState
from agent.tools.approval import data_classification, requires_approval
from agent.tools.mcp import McpBearerAuthProvider
from config.settings import DataClassification
from core.auth_models import AuthenticationResult
from core.lf_prompts import PromptPool
from core.logtools import getLogger
from core.stream_cleanup import close_stream

if TYPE_CHECKING:
    from core.document_service import SelectedDocument

logger = getLogger(name="mucgpt-core-react-agent")

# Write one checkpoint when a run exits instead of one per graph step (LangGraph's
# "async" default). Only the latest checkpoint is ever read: we don't resume runs
# mid-way, so per-step checkpoints would only multiply stored message history.
# The state reached so far is still written if the run fails or is aborted.
# https://docs.langchain.com/oss/python/langgraph/checkpointers#durability-modes
CHECKPOINT_DURABILITY: Durability = "exit"

_APPROVAL_DECISIONS: InterruptOnConfig = {"allowed_decisions": ["approve", "reject"]}


@dataclass(frozen=True)
class PendingToolApproval:
    tool_call_id: str
    tool_name: str
    args: dict[str, Any]
    data_classification: DataClassification


class _ConfiguredLangChainDeepAgentGraph:
    """Simple wrapper around a LangChain agent to configure it with user info and tools on each run."""

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[BaseTool],
        logger,
        debug: bool = True,
        checkpointer: AsyncPostgresSaver | None = None,
        backend: BackendProtocol | None = None,
        permissions: list[FilesystemPermission] | None = None,
        document_selection: list["SelectedDocument"] | None = None,
    ):
        self.model = llm
        self.tools = tools
        self.logger = logger
        self.debug = debug
        default_prompt = PromptPool.get_resolved_prompt("default_instructions")
        self.default_langfuse_prompt = default_prompt.langfuse_prompt

        self.state_schema = DefaultAgentState
        self.approval_tools = {
            tool.name: tool for tool in tools if requires_approval(tool)
        }
        self.agent = create_deep_agent(
            model=cast(Any, self.model),
            tools=self.tools,
            middleware=[
                ContextMiddleware(
                    state_schema=self.state_schema,
                    document_selection=document_selection,
                ),
                # After ContextMiddleware: it filters tools as BaseTool objects.
                ToolStatusMiddleware(),
                ToolErrorMiddleware(),
                TokenUsageMiddleware(),
            ],  # type: ignore
            system_prompt=default_prompt.content,
            debug=self.debug,
            state_schema=self.state_schema,
            context_schema=RequestContext,
            checkpointer=checkpointer,
            backend=backend,
            permissions=permissions,
            interrupt_on={name: _APPROVAL_DECISIONS for name in self.approval_tools}
            or None,
        )

    def _prepare_run(
        self, input_data: dict[str, Any] | Command, config: RunnableConfig | None
    ) -> tuple[
        list[Any],
        list[dict[str, Any]] | None,
        RequestContext,
    ]:
        configurable = config.get("configurable", {}) if config else {}
        user_info = cast(AuthenticationResult | None, configurable.get("user_info"))
        if not user_info:
            raise ValueError("user_info is required in config for MUCGPTAgent")

        llm_user = configurable.get("llm_user")
        extra_body = configurable.get("llm_extra_body")
        enabled_tools = configurable.get("enabled_tools")
        selected_llm = configurable.get("llm")
        assistant_id = configurable.get("assistant_id")
        token_usage = configurable.get("token_usage")

        # Keep MCP auth token map up-to-date for forwarded auth providers.
        McpBearerAuthProvider.set_token(user_info.user_id, user_info.token)

        messages = (
            input_data.get("messages", []) if isinstance(input_data, dict) else []
        )
        data_sources = configurable.get("data_sources", [])
        canvas = configurable.get("canvas")

        request_context = RequestContext(
            assistant_id=str(assistant_id) if assistant_id else None,
            model_name=selected_llm,
            user=llm_user,
            temperature=configurable.get("llm_temperature", RequestContext.temperature),
            reasoning_effort=configurable.get("reasoning_effort"),
            stream=configurable.get("llm_streaming", False),
            extra_body=extra_body,
            enabled_tools=enabled_tools,
            token_usage=token_usage if isinstance(token_usage, TokenUsage) else None,
            langfuse_prompt=configurable.get(
                "langfuse_prompt", self.default_langfuse_prompt
            ),
            canvas=canvas,
            language=configurable.get("language"),
        )

        return messages, data_sources, request_context

    async def astream(
        self,
        input_data: dict[str, Any] | Command,
        *,
        stream_mode: list[str] | str | None = None,
        config: RunnableConfig | None = None,
        resume_decisions: list[dict[str, str]] | None = None,
        **kwargs,
    ):
        messages, data_sources, request_context = self._prepare_run(input_data, config)

        # Keep the stable graph schema visible in trace metadata without
        # mutating the caller's config dict.
        config = merge_configs(
            config or {},
            RunnableConfig(metadata={"agent_state_schema": self.state_schema.__name__}),
        )

        if isinstance(input_data, Command):
            graph_input = input_data
        elif resume_decisions is not None:
            graph_input = Command(resume={"decisions": resume_decisions})
        else:
            graph_input = {"messages": messages}
            if data_sources:
                graph_input["data_sources"] = data_sources  # type: ignore
            if request_context.canvas:
                graph_input["canvas"] = request_context.canvas  # type: ignore

        stream = self.agent.astream(
            graph_input,
            stream_mode=stream_mode,
            config=config,
            context=request_context,
            durability=CHECKPOINT_DURABILITY,
            **kwargs,
        )
        try:
            async for item in stream:
                yield item
        finally:
            await close_stream(stream)
            await self._checkpoint_working_canvas_on_pause(request_context, config)

    async def _checkpoint_working_canvas_on_pause(
        self, request_context: RequestContext, config: RunnableConfig
    ) -> None:
        """Preserve canvas mutations when an approval pauses the graph.

        Request context is rebuilt for a resume, unlike graph state. Canvas
        tools intentionally keep their working copy in that context to support
        parallel mutations, so write it to the checkpoint only at a pause.
        """
        if not self.approval_tools or request_context.canvas_working is None:
            return
        state = await self.agent.aget_state(config)
        if state.interrupts:
            await self.agent.aupdate_state(
                config, {"canvas": request_context.canvas_working}
            )

    async def get_pending_approvals(
        self, config: RunnableConfig
    ) -> list[PendingToolApproval]:
        """Return the tool calls the paused run in the checkpoint waits on, in interrupt order.

        The HITL interrupt only carries tool names and args, so the tool call ids
        come from the last AI message, which the middleware filters the same way.
        """
        if not self.approval_tools:
            return []
        state = await self.agent.aget_state(config)
        if not state.interrupts:
            return []
        action_requests = [
            request
            for interrupt in state.interrupts
            if isinstance(interrupt.value, dict)
            for request in interrupt.value.get("action_requests", [])
        ]
        last_ai_message = next(
            (
                message
                for message in reversed(state.values.get("messages", []))
                if isinstance(message, AIMessage)
            ),
            None,
        )
        tool_calls = [
            tool_call
            for tool_call in (last_ai_message.tool_calls if last_ai_message else [])
            if tool_call["name"] in self.approval_tools
        ]
        requested_names = [request["name"] for request in action_requests]
        # A mismatch would map an answer to the wrong call, so refuse instead.
        if not requested_names or requested_names != [
            tool_call["name"] for tool_call in tool_calls
        ]:
            raise ValueError(
                "The paused run can no longer be continued, send a new message instead"
            )
        return [
            PendingToolApproval(
                tool_call_id=str(tool_call["id"]),
                tool_name=tool_call["name"],
                args={
                    key: value
                    for key, value in tool_call["args"].items()
                    if key != TOOL_STATUS_ARG
                },
                data_classification=data_classification(
                    self.approval_tools[tool_call["name"]]
                ),
            )
            for tool_call in tool_calls
        ]

    async def ainvoke(
        self,
        input_data: dict[str, Any] | Command,
        *,
        config: RunnableConfig | None = None,
        **kwargs,
    ):
        messages, data_sources, request_context = self._prepare_run(input_data, config)

        # Merge agent_state_schema into trace metadata.
        config = merge_configs(
            config or {},
            RunnableConfig(metadata={"agent_state_schema": self.state_schema.__name__}),
        )

        input_payload: dict[str, Any] | Command = input_data
        if not isinstance(input_data, Command):
            input_payload = {"messages": messages}
            if data_sources:
                input_payload["data_sources"] = data_sources
            if request_context.canvas:
                input_payload["canvas"] = request_context.canvas

        return await self.agent.ainvoke(
            input_payload,
            config=config,
            context=request_context,
            durability=CHECKPOINT_DURABILITY,
            **kwargs,
        )

    async def aget_state(self, config: RunnableConfig):
        return await self.agent.aget_state(config)


class MUCGPTAgent:
    """MUCGPT Deep Agent."""

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[BaseTool],
        logger=None,
        debug: bool = True,
        checkpointer: AsyncPostgresSaver | None = None,
        backend: BackendProtocol | None = None,
        permissions: list[FilesystemPermission] | None = None,
        document_selection: list["SelectedDocument"] | None = None,
    ):
        self.logger = logger if logger else getLogger(name="mucgpt-core-react-agent")
        self.model = llm  # required for non-streaming calls, e.g. assisted MUCGPT-Assistant generation.
        self.graph = _ConfiguredLangChainDeepAgentGraph(
            llm=llm,
            tools=tools,
            logger=self.logger,
            debug=debug,
            checkpointer=checkpointer,
            backend=backend,
            permissions=permissions,
            document_selection=document_selection,
        )
