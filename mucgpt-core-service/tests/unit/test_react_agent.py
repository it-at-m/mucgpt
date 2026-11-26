from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from deepagents.backends.utils import create_file_data
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.runnables import RunnableConfig
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command
from tests.fakes.scripted_chat_model import ScriptedChatModel, read_file, text

from agent.deep_agent import MUCGPTAgent, _ConfiguredLangChainDeepAgentGraph
from agent.state_models.default_state import DefaultAgentState
from config.model_provider import ModelRegistry
from core import virtual_file_system_helper as vfs
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
    assert "durability" not in compiled_agent.ainvoke.call_args.kwargs
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
    assert "durability" not in compiled_agent.astream.call_args.kwargs
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
async def test_agent_uses_exit_durability_with_a_checkpointer(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    async def stream(*args, **kwargs):
        yield {"messages": []}

    compiled_agent = MagicMock()
    compiled_agent.astream = MagicMock(side_effect=stream)
    compiled_agent.ainvoke = AsyncMock(return_value={"messages": []})
    monkeypatch.setattr(
        "agent.deep_agent.create_deep_agent", MagicMock(return_value=compiled_agent)
    )
    graph = _ConfiguredLangChainDeepAgentGraph(
        llm=FakeListChatModel(responses=["response"]),
        tools=[],
        logger=MagicMock(),
        checkpointer=cast(Any, object()),
    )
    config = cast(RunnableConfig, {"configurable": {"user_info": user_info}})

    _ = [item async for item in graph.astream({"messages": []}, config=config)]
    await graph.ainvoke({"messages": []}, config=config)

    assert compiled_agent.astream.call_args.kwargs["durability"] == "exit"
    assert compiled_agent.ainvoke.call_args.kwargs["durability"] == "exit"


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
    config = cast(RunnableConfig, {"configurable": {"thread_id": "conversation-1"}})

    assert await graph.aget_state(config) is state
    compiled_agent.aget_state.assert_awaited_once_with(config)


@pytest.mark.asyncio
async def test_real_agent_dispatches_scripted_document_read(
    monkeypatch: pytest.MonkeyPatch,
    user_info: AuthenticationResult,
) -> None:
    document_id = "12345678-1234-4234-8234-123456789abc"
    path = vfs.get_document_path(document_id)
    store = InMemoryStore()
    monkeypatch.setattr(vfs.FileStoreManager, "_file_store", store)
    backend = vfs.create_backend(user_info.user_id, [document_id])
    store.put(
        vfs.get_document_namespace(user_info.user_id),
        vfs.get_document_storage_key(document_id),
        create_file_data("municipal source"),
    )

    model = ScriptedChatModel(
        script=[read_file(path, id="read-1"), text("The source is municipal.")]
    )
    monkeypatch.setattr(ModelRegistry, "get_model", lambda _name=None: model)
    monkeypatch.setattr(
        ModelRegistry, "normalize_model_settings", lambda _model, settings: settings
    )
    agent = MUCGPTAgent(
        llm=model,
        tools=[],
        backend=backend,
        permissions=vfs.create_permissions([document_id]),
    )

    result = await agent.graph.ainvoke(
        {"messages": [("user", "Read the attached document.")]},
        config={"configurable": {"user_info": user_info, "enabled_tools": []}},
    )

    assert result["messages"][-1].content == "The source is municipal."
    assert any(
        getattr(message, "tool_call_id", None) == "read-1"
        and "municipal source" in message.content
        for message in result["messages"]
    )
    assert any(
        schema["name"] == "read_file"
        for schemas in model.bound_tool_schemas
        for schema in schemas
    )
    assert any(
        any(
            getattr(message, "tool_call_id", None) == "read-1"
            for message in call.messages
        )
        for call in model.recorded_inputs[1:]
    )
    model.assert_consumed()
