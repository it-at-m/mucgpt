import logging
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from mcp.types import Tool as MCPTool
from pydantic import ValidationError

from agent.agent_executor import build_resume_decisions
from agent.deep_agent import PendingToolApproval, _ConfiguredLangChainDeepAgentGraph
from agent.middleware import RequestContext
from agent.tools.approval import (
    approval_metadata,
    data_classification,
    requires_approval,
)
from agent.tools.mcp import McpLoader
from agent.tools.spec import LocalTool
from api.api_models import CanvasState, ToolApprovalResumeEntry
from config.settings import MCPSourceConfig, MCPToolOverride
from core.auth_models import AuthenticationResult
from core.lf_prompts import ResolvedPrompt


def make_source(**kwargs: Any) -> MCPSourceConfig:
    return MCPSourceConfig(url="http://mcp", transport="sse", **kwargs)


class TestApprovalConfig:
    def test_defaults_need_no_approval_and_allow_only_public_data(self):
        assert McpLoader._resolve_approval(make_source(), None) == approval_metadata(
            False, "public"
        )

    def test_source_settings_apply_to_every_tool(self):
        source = make_source(require_approval=True, data_classification="internal")

        assert McpLoader._resolve_approval(source, None) == approval_metadata(
            True, "internal"
        )

    def test_override_wins_in_both_directions(self):
        source = make_source(require_approval=True, data_classification="internal")
        stricter = MCPToolOverride(
            name="read", require_approval=False, data_classification="confidential"
        )
        unset = MCPToolOverride(name="other", description="Only a description")

        assert McpLoader._resolve_approval(source, stricter) == approval_metadata(
            False, "confidential"
        )
        assert McpLoader._resolve_approval(source, unset) == approval_metadata(
            True, "internal"
        )

    def test_unknown_classification_is_rejected(self):
        with pytest.raises(ValidationError):
            make_source(data_classification="secret")

    def test_override_for_unknown_tool_is_logged(
        self, caplog: pytest.LogCaptureFixture
    ):
        source = make_source(overrides=[MCPToolOverride(name="web_serch")])
        raw_tools = [MCPTool(name="web_search", inputSchema={"type": "object"})]

        with caplog.at_level(logging.WARNING):
            McpLoader._warn_about_unknown_overrides("search", source, raw_tools)

        assert "web_serch" in caplog.text

    def test_local_tool_carries_its_settings(self):
        @tool
        def lookup(query: str) -> str:
            """Look something up."""
            return query

        spec = LocalTool(
            id="lookup",
            factory=lambda _logger: lookup,
            metadata={"english": {"name": "Lookup", "description": "Looks up"}},
            needs_model=False,
            require_approval=True,
            data_classification="internal",
        )

        built = spec.build(model=None, logger=logging.getLogger())  # type: ignore[arg-type]

        assert requires_approval(built)
        assert data_classification(built) == "internal"


def pending(*ids: str) -> list[PendingToolApproval]:
    return [
        PendingToolApproval(
            tool_call_id=tool_call_id,
            tool_name="web_search",
            args={},
            data_classification="public",
        )
        for tool_call_id in ids
    ]


def answer(interrupt_id: str, status: str = "resolved", decision: str | None = None):
    return ToolApprovalResumeEntry.model_validate(
        {
            "interruptId": interrupt_id,
            "status": status,
            "payload": {"decision": decision} if decision else None,
        }
    )


class TestBuildResumeDecisions:
    def test_keeps_the_call_order_and_only_approves_explicit_approvals(self):
        decisions = build_resume_decisions(
            pending("a", "b", "c"),
            [
                answer("c", decision="approve"),
                answer("a", decision="approve"),
                answer("b", status="cancelled"),
            ],
        )

        assert decisions == [
            {"type": "approve"},
            {"type": "reject"},
            {"type": "approve"},
        ]

    def test_a_rejection_is_not_run(self):
        assert build_resume_decisions(
            pending("a"), [answer("a", decision="reject")]
        ) == [{"type": "reject"}]

    @pytest.mark.parametrize(
        "answers",
        [
            [],
            [answer("a", decision="approve"), answer("x", decision="approve")],
            [answer("a", decision="approve"), answer("a", decision="approve")],
        ],
    )
    def test_every_paused_call_needs_exactly_one_answer(self, answers):
        with pytest.raises(ValueError):
            build_resume_decisions(pending("a"), answers)

    def test_nothing_to_continue(self):
        with pytest.raises(ValueError):
            build_resume_decisions([], [answer("a", decision="approve")])


class ScriptedModel(BaseChatModel):
    """Answers with the given messages in turn, whatever it is asked."""

    responses: list[AIMessage]

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        return ChatResult(generations=[ChatGeneration(message=self.responses.pop(0))])


class TestPausedRun:
    @pytest.fixture
    def searched(self) -> list[str]:
        return []

    @pytest.fixture
    def graph(
        self, monkeypatch: pytest.MonkeyPatch, searched: list[str]
    ) -> _ConfiguredLangChainDeepAgentGraph:
        monkeypatch.setattr(
            "agent.deep_agent.PromptPool.get_resolved_prompt",
            lambda _name, _folder=None: ResolvedPrompt(
                content="instructions", langfuse_prompt=None
            ),
        )
        model = ScriptedModel(
            responses=[
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": "call_web",
                            "name": "web_search",
                            "args": {
                                "status_message": "Suche im Netz",
                                "query": "Kita",
                            },
                        },
                        {
                            "id": "call_info",
                            "name": "instance_info",
                            "args": {"status_message": "Prüfe die Suche"},
                        },
                    ],
                ),
                AIMessage(content="Fertig"),
            ]
        )
        monkeypatch.setattr(
            "agent.middleware.ModelRegistry.get_model", lambda *_args: model
        )
        monkeypatch.setattr(
            "agent.middleware.ModelRegistry.normalize_model_settings",
            lambda _model, settings: settings,
        )

        @tool
        def web_search(query: str) -> str:
            """Search the web."""
            searched.append(query)
            return f"Ergebnisse zu {query}"

        @tool
        def instance_info() -> str:
            """Describe the search instance."""
            return "SearXNG"

        web_search.metadata = approval_metadata(True, "public")
        instance_info.metadata = approval_metadata(False, "public")
        return _ConfiguredLangChainDeepAgentGraph(
            llm=model,
            tools=[web_search, instance_info],
            logger=logging.getLogger(),
            checkpointer=InMemorySaver(),
        )

    @pytest.fixture
    def config(self) -> dict[str, Any]:
        user_info = AuthenticationResult(
            token="token", user_id="user", department="dep"
        )
        return {
            "configurable": {
                "thread_id": "thread",
                "user_info": user_info,
                "enabled_tools": ["web_search", "instance_info"],
            }
        }

    @pytest.mark.asyncio
    async def test_checkpoints_working_canvas_when_approval_pauses(self, graph, config):
        graph.agent.aget_state = AsyncMock(
            return_value=SimpleNamespace(interrupts=[object()])
        )
        graph.agent.aupdate_state = AsyncMock()
        working_canvas = CanvasState(content="Updated document")

        await graph._checkpoint_working_canvas_on_pause(
            RequestContext(canvas_working=working_canvas), config
        )

        graph.agent.aupdate_state.assert_awaited_once_with(
            config, {"canvas": working_canvas}
        )

    async def run(self, graph, config, input_data, resume_decisions=None) -> list[Any]:
        return [
            item
            async for item in graph.astream(
                input_data,
                stream_mode="updates",
                config=config,
                resume_decisions=resume_decisions,
            )
        ]

    @pytest.mark.asyncio
    async def test_pauses_before_a_call_that_needs_approval(
        self, graph, config, searched
    ):
        await self.run(
            graph, config, {"messages": [("user", "Wie teuer ist die Kita?")]}
        )

        assert searched == []
        assert await graph.get_pending_approvals(config) == [
            PendingToolApproval(
                tool_call_id="call_web",
                tool_name="web_search",
                args={"query": "Kita"},
                data_classification="public",
            )
        ]

    @pytest.mark.asyncio
    async def test_an_approved_call_runs_as_it_was_shown(self, graph, config, searched):
        await self.run(
            graph, config, {"messages": [("user", "Wie teuer ist die Kita?")]}
        )
        await self.run(
            graph,
            config,
            {"messages": []},
            resume_decisions=[{"type": "approve"}],
        )

        assert searched == ["Kita"]
        assert await graph.get_pending_approvals(config) == []

    @pytest.mark.asyncio
    async def test_a_rejected_call_never_runs(self, graph, config, searched):
        await self.run(
            graph, config, {"messages": [("user", "Wie teuer ist die Kita?")]}
        )
        await self.run(
            graph,
            config,
            {"messages": []},
            resume_decisions=[{"type": "reject"}],
        )

        state = await graph.agent.aget_state(config)
        rejection = next(
            message
            for message in state.values["messages"]
            if isinstance(message, ToolMessage) and message.tool_call_id == "call_web"
        )
        assert searched == []
        assert rejection.status == "error"

    @pytest.mark.asyncio
    async def test_a_new_message_cancels_the_paused_calls(
        self, graph, config, searched
    ):
        await self.run(
            graph, config, {"messages": [("user", "Wie teuer ist die Kita?")]}
        )
        await self.run(graph, config, {"messages": [("user", "Egal, danke")]})

        state = await graph.agent.aget_state(config)
        answered = {
            message.tool_call_id
            for message in state.values["messages"]
            if isinstance(message, ToolMessage)
        }
        assert searched == []
        assert answered == {"call_web", "call_info"}
        assert state.values["messages"][-1].content == "Fertig"
        assert await graph.get_pending_approvals(config) == []

    @pytest.mark.asyncio
    async def test_a_pause_for_tools_that_changed_since_cannot_be_continued(
        self, graph, config
    ):
        await self.run(
            graph, config, {"messages": [("user", "Wie teuer ist die Kita?")]}
        )
        web_search, instance_info = graph.tools
        web_search.metadata = approval_metadata(False, "public")
        instance_info.metadata = approval_metadata(True, "public")
        changed_graph = _ConfiguredLangChainDeepAgentGraph(
            llm=graph.model,
            tools=graph.tools,
            logger=logging.getLogger(),
            checkpointer=graph.agent.checkpointer,
        )

        with pytest.raises(ValueError):
            await changed_graph.get_pending_approvals(config)
