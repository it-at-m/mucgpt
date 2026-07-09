from collections.abc import Awaitable, Callable
from types import SimpleNamespace
from typing import Any

import pytest
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ExtendedModelResponse,
    ModelRequest,
    ModelResponse,
)
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage as LangChainAIMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from agent import middleware


def test_get_assistant_id_from_request_context():
    request = type(
        "Request",
        (),
        {
            "runtime": SimpleNamespace(
                context=middleware.RequestContext(assistant_id="assistant-123")
            )
        },
    )()

    assert middleware._get_assistant_id_from_request(request) == "assistant-123"


def test_get_assistant_id_from_runtime_config_fallback(monkeypatch):
    monkeypatch.setattr(
        middleware,
        "get_runtime_config",
        lambda: {"configurable": {"assistant_id": "assistant-123"}},
    )
    request = type("Request", (), {"runtime": None})()

    assert middleware._get_assistant_id_from_request(request) == "assistant-123"


def test_get_assistant_id_from_request_missing(monkeypatch):
    monkeypatch.setattr(middleware, "get_runtime_config", lambda: {"configurable": {}})
    request = type("Request", (), {"runtime": None})()

    assert middleware._get_assistant_id_from_request(request) is None


class CapturingMiddleware(
    AgentMiddleware[Any, middleware.AgentContext, Any]
):
    def __init__(self):
        self.assistant_id = None

    def wrap_model_call(
        self,
        request: ModelRequest[middleware.AgentContext],
        handler: Callable[
            [ModelRequest[middleware.AgentContext]], ModelResponse[Any]
        ],
    ) -> ModelResponse[Any] | LangChainAIMessage | ExtendedModelResponse[Any]:
        self.assistant_id = middleware._get_assistant_id_from_request(request)
        return handler(request)

    async def awrap_model_call(
        self,
        request: ModelRequest[middleware.AgentContext],
        handler: Callable[
            [ModelRequest[middleware.AgentContext]], Awaitable[ModelResponse[Any]]
        ],
    ) -> ModelResponse[Any] | LangChainAIMessage | ExtendedModelResponse[Any]:
        self.assistant_id = middleware._get_assistant_id_from_request(request)
        return await handler(request)


class DummyChatModel(BaseChatModel):
    @property
    def _llm_type(self) -> str:
        return "dummy"

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        return ChatResult(
            generations=[ChatGeneration(message=LangChainAIMessage(content="ok"))]
        )


@pytest.mark.asyncio
async def test_assistant_id_is_available_in_agent_middleware_context():
    capturing_middleware = CapturingMiddleware()
    agent = create_agent(
        model=DummyChatModel(),
        tools=[],
        middleware=[capturing_middleware],
        context_schema=middleware.RequestContext,
    )

    await agent.ainvoke(
        {"messages": [{"role": "user", "content": "hello"}]},
        context=middleware.RequestContext(assistant_id="assistant-123"),
    )

    assert capturing_middleware.assistant_id == "assistant-123"
