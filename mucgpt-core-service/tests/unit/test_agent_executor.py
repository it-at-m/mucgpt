from contextlib import nullcontext
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, ToolCall

from agent.agent_executor import MUCGPTAgentExecutor
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from api.api_models import ChatCompletionMessage as InputMessage


class DummyLLM:
    def __init__(self, respond_with_tool_call=False):
        self.config = None
        self.tools = None
        self.respond_with_tool_call = respond_with_tool_call
        self.invoked_messages = []

    def bind(self, **kwargs):
        return self

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
        self.graph.ainvoke = AsyncMock(
            side_effect=RuntimeError("Simulated failure") if llm.fail else None,
            return_value={"messages": [AIMessage(content="Simplified text.")]},
        )


class FakeLangfuseSpan:
    def __init__(self):
        self.updates = []

    def update(self, **kwargs):
        self.updates.append(kwargs)


class FakeLangfuseClient:
    def __init__(self):
        self.current_span_updates = []
        self.spans = []

    def update_current_span(self, **kwargs):
        self.current_span_updates.append(kwargs)

    def start_as_current_observation(self, **_kwargs):
        span = FakeLangfuseSpan()
        self.spans.append(span)
        return nullcontext(span)


class StreamingGraph:
    async def astream(self, *_args, **_kwargs):
        yield (
            "messages",
            (
                AIMessageChunk(content="hidden"),
                {"langgraph_node": "model", "run_name": "internal_scope_router"},
            ),
        )
        yield (
            "messages",
            (AIMessageChunk(content="visible"), {"langgraph_node": "model"}),
        )
        yield (
            "custom",
            ToolStreamChunk(
                state=ToolStreamState.STARTED,
                content="started",
                tool_name="example_tool",
            ).model_dump_json(),
        )
        yield ("updates", {"agent": {"messages": [AIMessage(content="done")]}})


class StreamingAgent:
    def __init__(self):
        self.model = DummyRunnerLLM()
        self.graph = StreamingGraph()


class TestMUCGPTAgentExecutor:
    def setup_method(self):
        self.llm = DummyRunnerLLM()
        self.agent = DummyAgent(self.llm)
        self.runner = MUCGPTAgentExecutor(self.agent)

    @pytest.mark.skip(reason="Temporarily disabled")
    @pytest.mark.asyncio
    async def test_run_with_streaming_yields_content(self):
        messages = [InputMessage(role="user", content="hi")]
        chunks = []
        async for chunk in self.runner.run_with_streaming(
            messages=messages,
            temperature=0.7,
            model="test",
            user_info=None,
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
            model="test",
            user_info=None,
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
            model="test",
            user_info=None,
        ):
            chunks.append(chunk)
        # The last chunk should have finish_reason "stop"
        assert chunks[-1]["choices"][0]["finish_reason"] == "stop"

    @pytest.mark.asyncio
    async def test_run_without_streaming_returns_error_message_on_exception(self):
        llm = DummyRunnerLLM(fail=True)
        agent = DummyAgent(llm)
        runner = MUCGPTAgentExecutor(agent)
        messages = [InputMessage(role="user", content="fail")]
        response = await runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            model="test",
            user_info=None,
        )
        assert response.choices[0].message.content is not None
        assert response.choices[0].finish_reason == "error"

    @pytest.mark.skip(reason="Temporarily disabled")
    def test_run_without_streaming_uses_enabled_tools_in_config(self):
        llm = DummyRunnerLLM()
        agent = DummyAgent(llm)
        runner = MUCGPTAgentExecutor(agent)
        messages = [InputMessage(role="user", content="hi")]
        enabled_tools = ["simplify"]
        runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            model="test",
            user_info=None,
            enabled_tools=enabled_tools,
        )
        assert llm.config["enabled_tools"] == enabled_tools

    @pytest.mark.skip(reason="Temporarily disabled")
    def test_run_without_streaming_sets_llm_config(self):
        llm = DummyRunnerLLM()
        agent = DummyAgent(llm)
        runner = MUCGPTAgentExecutor(agent)
        messages = [InputMessage(role="user", content="hi")]
        runner.run_without_streaming(
            messages=messages,
            temperature=0.5,
            model="test-model",
            user_info=None,
        )
        assert llm.config["llm_temperature"] == 0.5
        assert llm.config["llm"] == "test-model"
        assert llm.config["llm_streaming"] is False

    @pytest.mark.asyncio
    async def test_run_without_streaming_invokes_agent_graph(self):
        messages = [InputMessage(role="user", content="hi")]

        response = await self.runner.run_without_streaming(
            messages=messages,
            temperature=0.5,
            model="test-model",
            user_info=None,
            enabled_tools=["simplify"],
        )

        assert response.choices[0].message.content == "Simplified text."
        call = self.agent.graph.ainvoke.await_args
        config = call.kwargs["config"]["configurable"]
        assert config["llm_temperature"] == 0.5
        assert config["llm"] == "test-model"
        assert config["llm_streaming"] is False
        assert config["enabled_tools"] == ["simplify"]

    @pytest.mark.asyncio
    async def test_run_without_streaming_returns_error_on_exception(self):
        llm = DummyRunnerLLM(fail=True)
        agent = DummyAgent(llm)
        runner = MUCGPTAgentExecutor(agent)
        messages = [InputMessage(role="user", content="fail")]
        response = await runner.run_without_streaming(
            messages=messages,
            temperature=0.7,
            model="test",
            user_info=None,
        )
        assert response.choices[0].finish_reason == "error"

    @pytest.mark.asyncio
    async def test_run_with_streaming_attaches_usage_to_final_chunk(self):
        class UsageGraph:
            async def astream(self, *_args, **_kwargs):
                yield (
                    "messages",
                    (
                        AIMessageChunk(
                            content="hi",
                            usage_metadata={
                                "input_tokens": 12,
                                "output_tokens": 3,
                                "total_tokens": 15,
                            },
                        ),
                        {"langgraph_node": "model"},
                    ),
                )

        class UsageAgent:
            def __init__(self):
                self.model = DummyRunnerLLM()
                self.graph = UsageGraph()

        runner = MUCGPTAgentExecutor(UsageAgent())

        chunks = []
        async for chunk in runner.run_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.7,
            model="test",
            user_info=None,
        ):
            chunks.append(chunk)

        stop_chunk = chunks[-1]
        assert stop_chunk["choices"][0]["finish_reason"] == "stop"
        assert stop_chunk["usage"] == {
            "prompt_tokens": 12,
            "completion_tokens": 3,
            "total_tokens": 15,
            "context_tokens": 15,
        }

    @pytest.mark.asyncio
    async def test_run_with_streaming_aggregates_cost_usage_and_keeps_last_context(
        self,
    ):
        class UsageGraph:
            async def astream(self, *_args, **_kwargs):
                for content, input_tokens, output_tokens in (
                    ("tool call", 10, 2),
                    ("final answer", 20, 4),
                ):
                    yield (
                        "messages",
                        (
                            AIMessageChunk(
                                content=content,
                                usage_metadata={
                                    "input_tokens": input_tokens,
                                    "output_tokens": output_tokens,
                                    "total_tokens": input_tokens + output_tokens,
                                },
                            ),
                            {"langgraph_node": "model"},
                        ),
                    )

        class UsageAgent:
            def __init__(self):
                self.model = DummyRunnerLLM()
                self.graph = UsageGraph()

        runner = MUCGPTAgentExecutor(UsageAgent())

        chunks = []
        async for chunk in runner.run_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.7,
            model="test",
            user_info=None,
        ):
            chunks.append(chunk)

        # prompt_tokens for each invocation already includes the full
        # conversation so far (system prompt, history, earlier tool-call
        # rounds), so the final chunk should report the latest prompt_tokens
        # (not a sum across invocations) while completion_tokens - newly
        # generated per invocation - are correctly additive.
        assert chunks[-1]["usage"] == {
            "prompt_tokens": 20,
            "completion_tokens": 6,
            "total_tokens": 26,
            "context_tokens": 24,
        }

    @pytest.mark.asyncio
    async def test_run_with_streaming_traces_internal_tool_and_update_events(
        self, monkeypatch
    ):
        langfuse_client = FakeLangfuseClient()
        monkeypatch.setattr("agent.agent_executor.get_client", lambda: langfuse_client)
        monkeypatch.setattr(
            "agent.agent_executor.propagate_attributes",
            lambda **_kwargs: nullcontext(),
        )
        runner = MUCGPTAgentExecutor(StreamingAgent())

        chunks = []
        async for chunk in runner.run_with_streaming(
            messages=[InputMessage(role="user", content="hi")],
            temperature=0.7,
            model="test",
            user_info=None,
            conversation_id="chat-123",
        ):
            chunks.append(chunk)

        streamed_content = "".join(
            choice["delta"].get("content") or ""
            for chunk in chunks
            for choice in chunk["choices"]
        )
        assert "visible" in streamed_content
        assert "hidden" not in streamed_content

        trace_span = langfuse_client.spans[0]
        trace_output = trace_span.updates[0]["output"]
        events = trace_output["events"]
        assert [event["stream"] for event in events] == [
            "messages",
            "messages",
            "custom",
            "updates",
        ]
        assert events[0]["internal"] is True
        assert events[0]["content"] == "hidden"
        assert events[2]["content"]["tool_name"] == "example_tool"
        assert events[3]["content"]["agent"]["messages"][0]["content"] == "done"
