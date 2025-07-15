from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolCall

from agent.agent import MUCGPTAgent
from agent.tools import ToolCollection


class MockToolChunk:
    """A mock chunk that simulates the tool streaming events."""

    def __init__(self, name, is_start=True, args=None, output=None):
        self.name = name
        self.is_start = is_start
        self.args = args or {}
        self.output = output
        self.content = None
        self.tool_calls = [
            {
                "name": self.name,
                "status": "started" if is_start else "finished",
                "args": self.args if is_start else None,
                "output": None if is_start else self.output,
            }
        ]


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


class TestAgent:
    def setup_method(self):
        self.llm = DummyLLM()

    def test_agent_initialization_with_all_tools(self):
        agent = MUCGPTAgent(self.llm)
        all_tool_names = set(t.name for t in ToolCollection(self.llm).get_all())
        agent_tool_names = set(t.name for t in agent.tools)
        assert agent_tool_names == all_tool_names, (
            f"Expected all tools enabled, got {agent_tool_names} vs {all_tool_names}"
        )
        assert agent.graph is not None, "graph should not be None"

    def test_toolcollection_get_all_filters_tools_correctly(self):
        dummy_llm = DummyLLM()
        tool_collection = ToolCollection(dummy_llm)
        all_tools = tool_collection.get_all()
        all_tool_names = set(t.name for t in all_tools)

        # Test with a valid subset
        subset = list(all_tool_names)[:2]
        filtered_tools = tool_collection.get_all(subset)
        filtered_names = set(t.name for t in filtered_tools)
        assert filtered_names == set(subset), (
            f"Expected {set(subset)}, got {filtered_names}"
        )

        # Test with an invalid tool name
        filtered_tools = tool_collection.get_all(["not_a_real_tool"])
        assert filtered_tools == [], "Expected empty list for invalid tool name"

        # Test with mixed valid and invalid
        mixed = list(all_tool_names)[:1] + ["not_a_real_tool"]
        filtered_tools = tool_collection.get_all(mixed)
        filtered_names = set(t.name for t in filtered_tools)
        assert filtered_names == set(list(all_tool_names)[:1]), (
            f"Expected only valid tool, got {filtered_names}"
        )

        # Test that order does not matter
        reversed_subset = list(reversed(subset))
        filtered_tools_reversed = tool_collection.get_all(reversed_subset)
        filtered_names_reversed = set(t.name for t in filtered_tools_reversed)
        assert filtered_names_reversed == set(subset), (
            "Order of enabled_tools should not affect result"
        )

    def test_call_model_binds_tools_and_injects_instructions(self):
        agent = MUCGPTAgent(DummyLLM())
        state = {"messages": [AIMessage(content="hi")]}  # minimal state
        config = {
            "enabled_tools": [t.name for t in ToolCollection(agent.model).get_all()]
        }
        # Patch toolCollection methods to track calls
        called = {"bind_tools": False, "add_instructions": False}
        orig_bind_tools = agent.model.bind_tools
        orig_add_instructions = agent.toolCollection.add_instructions

        def bind_tools_patch(tools):
            called["bind_tools"] = True
            return orig_bind_tools(tools)

        def add_instructions_patch(messages, enabled_tools):
            called["add_instructions"] = True
            return orig_add_instructions(messages, enabled_tools)

        agent.model.bind_tools = bind_tools_patch
        agent.toolCollection.add_instructions = add_instructions_patch
        agent.call_model(state, config)
        assert called["bind_tools"], (
            "bind_tools should be called when enabled_tools is set"
        )
        assert called["add_instructions"], (
            "add_instructions should be called when enabled_tools is set"
        )

    def test_call_model_returns_correct_structure(self):
        agent = MUCGPTAgent(DummyLLM())
        state = {"messages": [AIMessage(content="hi")]}  # minimal state
        config = {}
        result = agent.call_model(state, config)
        assert isinstance(result, dict), "call_model should return a dict"
        assert "messages" in result, "call_model result should have 'messages' key"
        assert isinstance(result["messages"], list), (
            "call_model 'messages' should be a list"
        )

    def test_add_instructions_modifies_or_inserts_system_message(self):
        tool_collection = ToolCollection(DummyLLM())
        enabled_tools = [t.name for t in tool_collection.get_all()]
        # Case 1: system message exists
        messages = [SystemMessage(content="sys"), HumanMessage(content="hi")]
        updated = tool_collection.add_instructions(messages[:], enabled_tools)
        assert isinstance(updated[0], SystemMessage)
        assert "You have access to the following tools" in updated[0].content
        # Case 2: no system message
        messages = [HumanMessage(content="hi")]
        updated = tool_collection.add_instructions(messages[:], enabled_tools)
        assert isinstance(updated[0], SystemMessage)
        assert "You have access to the following tools" in updated[0].content
