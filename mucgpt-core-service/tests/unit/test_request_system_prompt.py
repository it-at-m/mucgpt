"""The system prompt is applied per request and never stored in the checkpoint."""

from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, patch

import pytest
from langchain.agents.middleware import ModelRequest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

import init_app
from agent.middleware import RequestContext, _apply_request_system_prompt
from core.auth_models import AuthenticationResult
from core.lf_prompts import ResolvedPrompt
from core.persistance_helpers import PersistanceHelpers
from init_app import init_agent


class _Request:
    """Just enough of a ModelRequest for the helper."""

    def __init__(self, messages, system_prompt):
        self.messages = messages
        self.runtime = SimpleNamespace(
            context=RequestContext(system_prompt=system_prompt)
        )

    def override(self, messages):
        return _Request(messages, self.runtime.context.system_prompt)


def _apply(request: _Request) -> _Request:
    return cast(_Request, _apply_request_system_prompt(cast(ModelRequest, request)))


def _texts(messages):
    return [(type(m).__name__, m.text) for m in messages]


def test_stale_leading_prompt_is_replaced():
    request = _Request([SystemMessage("old"), HumanMessage("q"), AIMessage("a")], "new")
    result = _apply(request)
    assert _texts(result.messages) == [
        ("SystemMessage", "new"),
        ("HumanMessage", "q"),
        ("AIMessage", "a"),
    ]


def test_empty_prompt_removes_stale_one():
    request = _Request([SystemMessage("old"), HumanMessage("q")], "")
    result = _apply(request)
    assert _texts(result.messages) == [("HumanMessage", "q")]


def test_no_prompt_info_keeps_stored_messages():
    # e.g. a resume, the request carries no messages at all
    messages = [SystemMessage("stored"), HumanMessage("q")]
    request = _Request(messages, None)
    assert _apply(request).messages is messages


def test_system_messages_later_in_history_stay():
    # deepagents inserts its own system messages further down
    request = _Request(
        [HumanMessage("q"), SystemMessage("tool disclosure"), AIMessage("a")], "new"
    )
    result = _apply(request)
    assert _texts(result.messages) == [
        ("SystemMessage", "new"),
        ("HumanMessage", "q"),
        ("SystemMessage", "tool disclosure"),
        ("AIMessage", "a"),
    ]


class _RecordingModel(GenericFakeChatModel):
    """Fake model that remembers what it was sent."""

    seen: list = []

    def bind_tools(self, tools, **kwargs):
        return self

    async def _agenerate(self, messages, *args, **kwargs):
        self.seen.append(list(messages))
        return await super()._agenerate(messages, *args, **kwargs)


@pytest.mark.asyncio
@patch("agent.tools.tools.ToolCollection.get_tools", new_callable=AsyncMock)
async def test_changed_prompt_reaches_existing_chat(mock_get_tools, monkeypatch):
    model = _RecordingModel(messages=iter([AIMessage("a1"), AIMessage("a2")]))
    model.seen = []
    mock_get_tools.return_value = []
    saver = InMemorySaver()
    monkeypatch.setattr(
        "config.model_provider.ModelRegistry.get_model", lambda *_a, **_k: model
    )
    monkeypatch.setattr(
        "agent.deep_agent.PromptPool.get_resolved_prompt",
        lambda _name, _folder=None: ResolvedPrompt(content="default instruction"),
    )
    monkeypatch.setattr(PersistanceHelpers, "get_checkpointer_if_ready", lambda: saver)
    monkeypatch.setattr(init_app.FileStoreManager, "get_store", InMemoryStore)
    user = AuthenticationResult(token="token", user_id="user", department="dep")
    config = RunnableConfig(configurable={"thread_id": "chat-1", "user_info": user})

    executor = await init_agent(user)
    await executor.agent.graph.ainvoke(
        {"messages": [SystemMessage("prompt v1"), HumanMessage("q1")]}, config=config
    )
    # second turn on the stored chat, the assistant prompt was edited meanwhile
    await executor.agent.graph.ainvoke(
        {"messages": [SystemMessage("prompt v2"), HumanMessage("q2")]}, config=config
    )

    sent = _texts(model.seen[-1])
    assert ("SystemMessage", "prompt v2") in sent
    assert ("SystemMessage", "prompt v1") not in sent
    assert sent[-1] == ("HumanMessage", "q2")

    checkpoint = await saver.aget_tuple(config)
    assert checkpoint is not None
    stored = checkpoint.checkpoint["channel_values"]["messages"]
    assert not any(isinstance(m, SystemMessage) for m in stored)
    assert _texts(stored) == [
        ("HumanMessage", "q1"),
        ("AIMessage", "a1"),
        ("HumanMessage", "q2"),
        ("AIMessage", "a2"),
    ]
