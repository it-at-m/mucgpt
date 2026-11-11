from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.types import Command

from agent.deep_agent import _ConfiguredLangChainDeepAgentGraph
from agent.state_models.default_state import DefaultAgentState
from core.auth_models import AuthenticationResult
from core.lf_prompts import ResolvedPrompt


@pytest.fixture
def user_info() -> AuthenticationResult:
    return AuthenticationResult(
        token="token",
        user_id="user-id",
        department="department",
    )


@pytest.fixture(autouse=True)
def default_prompt(monkeypatch: pytest.MonkeyPatch) -> ResolvedPrompt:
    prompt = ResolvedPrompt(content="default instruction", langfuse_prompt=object())
    monkeypatch.setattr(
        "agent.deep_agent.PromptPool.get_resolved_prompt",
        lambda _name: prompt,
    )
    return prompt


def test_prepare_run_uses_default_langfuse_prompt_unless_overridden(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
    default_prompt: ResolvedPrompt,
) -> None:
    monkeypatch.setattr("agent.deep_agent.create_deep_agent", MagicMock())
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )

    _, _, default_context = graph._prepare_run(
        {"messages": []}, config={"configurable": {"user_info": user_info}}
    )
    override = object()
    _, _, override_context = graph._prepare_run(
        {"messages": []},
        config={"configurable": {"user_info": user_info, "langfuse_prompt": override}},
    )

    assert default_context.langfuse_prompt is default_prompt.langfuse_prompt
    assert override_context.langfuse_prompt is override


def test_prepare_run_builds_image_hydrator_only_for_managed_images(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
    default_prompt: ResolvedPrompt,
) -> None:
    from core.image_hydration import ImageHydrator

    monkeypatch.setattr("agent.deep_agent.create_deep_agent", MagicMock())
    built = MagicMock(return_value=MagicMock(spec=ImageHydrator))
    monkeypatch.setattr("agent.deep_agent.build_image_hydrator", built)
    monkeypatch.setattr(
        "agent.deep_agent.contains_managed_images",
        lambda messages: any("image" in str(message) for message in messages),
    )
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )

    managed_messages = ["message with image"]
    messages, _, context = graph._prepare_run(
        {"messages": managed_messages},
        config={
            "configurable": {
                "user_info": user_info,
                "thread_id": "conv-1",
            }
        },
    )
    built.assert_called_once_with(user_info, "conv-1", False)
    assert context.image_hydrator is built.return_value

    built.reset_mock()
    _, _, context = graph._prepare_run(
        {"messages": ["plain text"]},
        config={"configurable": {"user_info": user_info}},
    )
    built.assert_not_called()
    assert context.image_hydrator is None


@pytest.mark.asyncio
async def test_ainvoke_reuses_compiled_agent_for_tool_changes(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    compiled_agent = MagicMock()
    compiled_agent.ainvoke = AsyncMock(return_value={"messages": []})
    create_agent = MagicMock(return_value=compiled_agent)
    monkeypatch.setattr("agent.deep_agent.create_deep_agent", create_agent)
    graph = _ConfiguredLangChainDeepAgentGraph(
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
    assert (
        compiled_agent.ainvoke.call_args.kwargs["config"]["metadata"][
            "agent_state_schema"
        ]
        == DefaultAgentState.__name__
    )


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
    monkeypatch.setattr("agent.deep_agent.create_deep_agent", create_agent)
    graph = _ConfiguredLangChainDeepAgentGraph(
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
    assert (
        compiled_agent.astream.call_args.kwargs["config"]["metadata"][
            "agent_state_schema"
        ]
        == DefaultAgentState.__name__
    )


@pytest.mark.asyncio
async def test_astream_forwards_resume_command_to_compiled_agent(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    async def stream(*args, **kwargs):
        yield {"messages": []}

    compiled_agent = MagicMock()
    compiled_agent.astream = MagicMock(side_effect=stream)
    monkeypatch.setattr(
        "agent.deep_agent.create_deep_agent", MagicMock(return_value=compiled_agent)
    )
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )
    command = Command(resume={"interrupt-1": {"answer": "yes"}})

    _ = [
        item
        async for item in graph.astream(
            command,
            config={"configurable": {"user_info": user_info}},
        )
    ]

    assert compiled_agent.astream.call_args.args[0] is command


@pytest.mark.asyncio
async def test_ainvoke_forwards_resume_command_to_compiled_agent(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    compiled_agent = MagicMock()
    compiled_agent.ainvoke = AsyncMock(return_value={"messages": []})
    monkeypatch.setattr(
        "agent.deep_agent.create_deep_agent", MagicMock(return_value=compiled_agent)
    )
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )
    command = Command(resume={"interrupt-1": {"answer": "yes"}})

    await graph.ainvoke(command, config={"configurable": {"user_info": user_info}})

    assert compiled_agent.ainvoke.call_args.args[0] is command


@pytest.mark.asyncio
async def test_aget_state_delegates_to_compiled_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state = object()
    compiled_agent = MagicMock()
    compiled_agent.aget_state = AsyncMock(return_value=state)
    monkeypatch.setattr(
        "agent.deep_agent.create_deep_agent", MagicMock(return_value=compiled_agent)
    )
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
    )
    config = {"configurable": {"thread_id": "conversation-1"}}

    assert await graph.aget_state(config) is state
    compiled_agent.aget_state.assert_awaited_once_with(config)
