from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage, ToolCall

from agent.agent_executor import MUCGPTAgentExecutor
from api.api_models import ChatCompletionMessage as InputMessage
from config.settings import Settings


class DummyLLM:
    def __init__(self, respond_with_tool_call=False):
        self.config = None
        self.tools = None
        self.respond_with_tool_call = respond_with_tool_call
        self.invoked_messages = []

    def with_config(self, configurable=None, **kwargs):
        if configurable:
            self.config = configurable
        else:
            self.config = kwargs
        return self

    def bind_tools(self, tools):
        self.tools = tools
        return self

    def invoke(self, msgs):
        # Store messages for assertions
        self.invoked_messages = msgs
        # For non-streaming calls
        return AIMessage(content="<einfachesprache>Simplified text.</einfachesprache>")

    async def astream(self, msgs):
        """Simulate a streaming response that includes tool calls."""
        # Store messages for assertions
        self.invoked_messages = msgs

        if self.respond_with_tool_call:
            # 1. First yield a chunk with a tool call
            tool_call = ToolCall(
                name="simplify", args={"text": "some complex text"}, id="call_123"
            )
            yield AIMessage(content="", tool_calls=[tool_call])

            # 2. Yield the final content
            yield AIMessage(content="Here's the simplified text: Simplified text.")
        else:
            # Regular response without tool calls
            yield AIMessage(content="Simplified text.")

    async def ainvoke(self, msgs):
        """Async version of invoke for the agent_async node."""
        # Store messages for assertions
        self.invoked_messages = msgs
        return AIMessage(content="<einfachesprache>Simplified text.</einfachesprache>")


class DummyRunnerLLM(DummyLLM):
    def __init__(self, respond_with_tool_call=False, fail=False):
        super().__init__(respond_with_tool_call=respond_with_tool_call)
        self.fail = fail

    async def astream(self, msgs):
        if self.fail:
            raise RuntimeError("Simulated failure")
        if self.respond_with_tool_call:
            tool_call = ToolCall(
                name="simplify", args={"text": "some complex text"}, id="call_123"
            )
            yield AIMessage(content="", tool_calls=[tool_call])
            yield AIMessage(content="Here's the simplified text: Simplified text.")
        else:
            yield AIMessage(content="Simplified text.")

    def invoke(self, msgs):
        if self.fail:
            raise RuntimeError("Simulated failure")
        return AIMessage(content="Simplified text.")


class DummyAgent:
    def __init__(self, llm):
        self.model = llm
        self.graph = MagicMock()
        self.graph.astream = llm.astream


class TestMUCGPTAgentExecutor:
    def setup_method(self):
        self.llm = DummyRunnerLLM()
        self.agent = DummyAgent(self.llm)
        self.settings = Settings()
        self.runner = MUCGPTAgentExecutor(self.agent, self.settings)

    @pytest.mark.skip(reason="Temporarily disabled")
    @pytest.mark.asyncio
    async def test_run_with_streaming_yields_content(self):
        messages = [InputMessage(role="user", content="hi")]
        chunks = []
        async for chunk in self.runner.run_with_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
        ):
            chunks.append(chunk)
        assert any(
            c["choices"][0]["delta"].get("content") == "Simplified text."
            for c in chunks
        )

    @pytest.mark.skip(reason="Temporarily disabled")
    @pytest.mark.asyncio
    async def test_run_with_streaming_yields_tool_call_chunk(self):
        llm = DummyRunnerLLM(respond_with_tool_call=True)
        agent = DummyAgent(llm)
        runner = MUCGPTAgentExecutor(agent)
        messages = [InputMessage(role="user", content="hi")]
        chunks = []
        async for chunk in runner.run_with_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
        ):
            chunks.append(chunk)
        # Should yield a chunk with tool_calls
        tool_call_chunks = [
            c for c in chunks if c["choices"][0]["delta"].get("tool_calls")
        ]
        assert tool_call_chunks, "Should yield at least one tool call chunk"
        tool_call = tool_call_chunks[0]["choices"][0]["delta"]["tool_calls"][0]
        assert tool_call["name"] == "simplify"
        assert tool_call["status"] == "started"

    @pytest.mark.skip(reason="Temporarily disabled")
    @pytest.mark.asyncio
    async def test_run_with_streaming_yields_stop_chunk(self):
        messages = [InputMessage(role="user", content="hi")]
        chunks = []
        async for chunk in self.runner.run_with_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
        ):
            chunks.append(chunk)
        # The last chunk should have finish_reason "stop"
        assert chunks[-1]["choices"][0]["finish_reason"] == "stop"

    def test_run_without_streaming_returns_error_message_on_exception(self):
        llm = DummyRunnerLLM(fail=True)
        agent = DummyAgent(llm)
        settings = Settings()
        runner = MUCGPTAgentExecutor(agent, settings)
        messages = [InputMessage(role="user", content="fail")]
        response = runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
        )
        assert response.choices[0].message.content is not None
        assert response.choices[0].finish_reason == "error"

    @pytest.mark.skip(reason="Temporarily disabled")
    def test_run_without_streaming_uses_enabled_tools_in_config(self):
        llm = DummyRunnerLLM()
        agent = DummyAgent(llm)
        settings = Settings()
        runner = MUCGPTAgentExecutor(agent, settings)
        messages = [InputMessage(role="user", content="hi")]
        enabled_tools = ["simplify"]
        runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
            enabled_tools=enabled_tools,
        )
        assert llm.config["enabled_tools"] == enabled_tools

    @pytest.mark.skip(reason="Temporarily disabled")
    def test_run_without_streaming_sets_llm_config(self):
        llm = DummyRunnerLLM()
        agent = DummyAgent(llm)
        settings = Settings()
        runner = MUCGPTAgentExecutor(agent, settings)
        messages = [InputMessage(role="user", content="hi")]
        runner.run_without_streaming(
            messages=messages,
            temperature=0.5,
            max_output_tokens=20,
            model="test-model",
            department=None,
        )
        assert llm.config["llm_max_tokens"] == 20
        assert llm.config["llm_temperature"] == 0.5
        assert llm.config["llm"] == "test-model"
        assert llm.config["llm_streaming"] is False

    def test_run_without_streaming_returns_error_on_exception(self):
        llm = DummyRunnerLLM(fail=True)
        agent = DummyAgent(llm)
        settings = Settings()
        runner = MUCGPTAgentExecutor(agent, settings)
        messages = [InputMessage(role="user", content="fail")]
        response = runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            max_output_tokens=10,
            model="test",
            department=None,
        )
        assert response.choices[0].finish_reason == "error"
