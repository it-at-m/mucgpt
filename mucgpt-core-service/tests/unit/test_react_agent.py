from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from agent.react_agent import _ConfiguredLangChainAgentGraph
from agent.state_models.default_state import DefaultAgentState
from core.auth_models import AuthenticationResult


@pytest.fixture
def user_info() -> AuthenticationResult:
    return AuthenticationResult(
        token="token",
        user_id="user-id",
        department="department",
    )


@pytest.mark.asyncio
async def test_ainvoke_reuses_compiled_agent_for_tool_changes(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    compiled_agent = MagicMock()
    compiled_agent.ainvoke = AsyncMock(return_value={"messages": []})
    create_agent = MagicMock(return_value=compiled_agent)
    monkeypatch.setattr("agent.react_agent.create_agent", create_agent)
    graph = _ConfiguredLangChainAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )

    assert graph.state_schema is DefaultAgentState
    assert create_agent.call_args.kwargs["state_schema"] is DefaultAgentState

    for enabled_tools in (["first"], ["second"]):
        await graph.ainvoke(
            {"messages": []},
            config={
                "configurable": {
                    "user_info": user_info,
                    "enabled_tools": enabled_tools,
                }
            },
        )

    create_agent.assert_called_once()
    assert compiled_agent.ainvoke.call_count == 2
    assert compiled_agent.ainvoke.call_args.kwargs["context"].enabled_tools == [
        "second"
    ]
    assert compiled_agent.ainvoke.call_args.kwargs["config"]["metadata"][
        "agent_state_schema"
    ] == DefaultAgentState.__name__


@pytest.mark.asyncio
async def test_astream_reuses_compiled_agent_for_tool_changes(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    async def stream(*args, **kwargs):
        yield {"messages": []}

    compiled_agent = MagicMock()
    compiled_agent.astream = MagicMock(side_effect=stream)
    create_agent = MagicMock(return_value=compiled_agent)
    monkeypatch.setattr("agent.react_agent.create_agent", create_agent)
    graph = _ConfiguredLangChainAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )

    assert graph.state_schema is DefaultAgentState
    assert create_agent.call_args.kwargs["state_schema"] is DefaultAgentState

    for enabled_tools in (["first"], ["second"]):
        items = [
            item
            async for item in graph.astream(
                {"messages": []},
                config={
                    "configurable": {
                        "user_info": user_info,
                        "enabled_tools": enabled_tools,
                    }
                },
            )
        ]
        assert items == [{"messages": []}]

    create_agent.assert_called_once()
    assert compiled_agent.astream.call_count == 2
    assert compiled_agent.astream.call_args.kwargs["context"].enabled_tools == [
        "second"
    ]
    assert compiled_agent.astream.call_args.kwargs["config"]["metadata"][
        "agent_state_schema"
    ] == DefaultAgentState.__name__
