import logging
from typing import Any, cast

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from agent.deep_agent import _ConfiguredLangChainDeepAgentGraph
from agent.tool_limits import tool_run_limit_middleware
from agent.tools.approval import approval_metadata
from core.auth_models import AuthenticationResult
from core.lf_prompts import ResolvedPrompt


class ToolCallingModel(GenericFakeChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def tool_calls(*ids: str, name: str = "search") -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {"id": id, "name": name, "args": {"status_message": "Searching"}}
            for id in ids
        ],
    )


def make_graph(monkeypatch, responses, *, approval=False):
    called = []

    @tool
    def search() -> str:
        """Search documents."""
        called.append("search")
        return "Found documents"

    @tool
    def info() -> str:
        """Describe the server."""
        called.append("info")
        return "Server information"

    search.metadata = {**approval_metadata(approval, "public"), "run_limit": 2}
    model = ToolCallingModel(messages=iter(responses))
    monkeypatch.setattr("agent.middleware.ModelRegistry.get_model", lambda *_a: model)
    monkeypatch.setattr(
        "agent.middleware.ModelRegistry.normalize_model_settings",
        lambda _model, settings: settings,
    )
    monkeypatch.setattr(
        "agent.deep_agent.PromptPool.get_resolved_prompt",
        lambda *_a: ResolvedPrompt(content="instructions"),
    )
    saver = InMemorySaver()
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=model,
        tools=[search, info],
        logger=logging.getLogger(),
        checkpointer=cast(Any, saver),
        debug=False,
    )
    config = RunnableConfig(
        configurable={
            "thread_id": "limited-chat",
            "user_info": AuthenticationResult(
                token="token", user_id="user", department="dep"
            ),
            "enabled_tools": ["search", "info"],
        }
    )
    return graph, config, called, saver


async def run(graph, config, *, resume=False, decisions=None):
    if resume and decisions is None:
        decisions = [{"type": "approve"}]
    return [
        item
        async for item in graph.astream(
            {"messages": [] if resume else [HumanMessage("Find documents")]},
            config=config,
            stream_mode="updates",
            resume_decisions=decisions,
        )
    ]


async def tool_messages(saver, config) -> list[ToolMessage]:
    checkpoint = await saver.aget_tuple(config)
    assert checkpoint is not None
    messages = checkpoint.checkpoint["channel_values"]["messages"]
    return [m for m in messages if isinstance(m, ToolMessage)]


@pytest.mark.asyncio
async def test_parallel_limit_blocks_excess_calls_and_resets_next_turn(monkeypatch):
    batch = tool_calls("one", "two", "three")
    batch.tool_calls.extend(tool_calls("info", name="info").tool_calls)
    graph, config, called, saver = make_graph(
        monkeypatch,
        [
            batch,
            AIMessage("done"),
            tool_calls("next"),
            AIMessage("done again"),
        ],
    )
    await run(graph, config)
    assert sorted(called) == ["info", "search", "search"]
    checkpoint = await saver.aget_tuple(config)
    assert checkpoint is not None
    messages = checkpoint.checkpoint["channel_values"]["messages"]
    blocked = [
        m for m in messages if isinstance(m, ToolMessage) and m.status == "error"
    ]
    assert [m.tool_call_id for m in blocked] == ["three"]
    await run(graph, config)
    assert sorted(called) == ["info", "search", "search", "search"]


@pytest.mark.asyncio
async def test_approval_resumes_keep_original_budget(monkeypatch):
    graph, config, called, _saver = make_graph(
        monkeypatch,
        [
            tool_calls("one"),
            tool_calls("two"),
            tool_calls("three"),
            AIMessage("done"),
            tool_calls("next"),
            AIMessage("done again"),
        ],
        approval=True,
    )
    await run(graph, config)
    assert called == []
    await run(graph, config, resume=True)
    assert called == ["search"]
    # The third call is over budget: it is blocked without asking for approval.
    await run(graph, config, resume=True)
    assert called == ["search", "search"]
    assert await graph.get_pending_approvals(config) == []
    await run(graph, config)
    await run(graph, config, resume=True)
    assert called == ["search", "search", "search"]


@pytest.mark.asyncio
async def test_rejected_calls_count_and_blocked_calls_skip_approval(monkeypatch):
    graph, config, called, saver = make_graph(
        monkeypatch,
        [tool_calls("one", "two", "three"), AIMessage("done")],
        approval=True,
    )
    await run(graph, config)
    pending = await graph.get_pending_approvals(config)
    assert [approval.tool_call_id for approval in pending] == ["one", "two"]
    await run(graph, config, resume=True, decisions=[{"type": "reject"}] * 2)
    assert called == []
    ids = [m.tool_call_id for m in await tool_messages(saver, config)]
    assert sorted(ids) == ["one", "three", "two"]


def test_tools_sharing_a_name_share_the_strictest_limit():
    @tool
    def search() -> str:
        """Search documents."""
        return ""

    @tool("search")
    def other_search() -> str:
        """Search elsewhere."""
        return ""

    search.metadata = {"run_limit": 4}
    other_search.metadata = {"run_limit": 2}
    limiters = tool_run_limit_middleware([search, other_search])
    assert list(limiters) == ["search"]
    assert limiters["search"].run_limit == 2


def test_unconfigured_tools_use_the_shared_default_limit():
    @tool
    def search() -> str:
        """Search documents."""
        return ""

    limiters = tool_run_limit_middleware([search])
    assert limiters["search"].run_limit == 10


def test_explicit_unlimited_tool_has_no_limiter():
    @tool
    def search() -> str:
        """Search documents."""
        return ""

    search.metadata = {"run_limit": None}
    assert tool_run_limit_middleware([search]) == {}
