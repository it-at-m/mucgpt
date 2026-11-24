import logging
from typing import Any, cast

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from agent.deep_agent import _ConfiguredLangChainDeepAgentGraph
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


async def run(graph, config, *, resume=False):
    return [
        item
        async for item in graph.astream(
            {"messages": [] if resume else [HumanMessage("Find documents")]},
            config=config,
            stream_mode="updates",
            resume_decisions=[{"type": "approve"}] if resume else None,
        )
    ]


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
    await run(graph, config, resume=True)
    assert called == ["search", "search"]
    # Deep Agents asks for approval before its after-model limit hooks run.
    await run(graph, config, resume=True)
    assert called == ["search", "search"]
    assert await graph.get_pending_approvals(config) == []
    await run(graph, config)
    await run(graph, config, resume=True)
    assert called == ["search", "search", "search"]
