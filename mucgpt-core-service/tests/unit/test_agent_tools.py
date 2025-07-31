from unittest.mock import MagicMock, mock_open, patch

from langchain_core.messages import HumanMessage, SystemMessage

from agent.tools.tools import ToolCollection


# Mock langgraph.config to avoid __pregel_runtime KeyError
@patch("agent.tools.tools.get_stream_writer")
class TestAgentTools:
    def setup_method(self):
        """Setup test fixtures before each test method"""
        # Create a mock LLM with necessary attributes for the restructured code
        self.mock_llm = MagicMock()
        self.mock_llm.with_config.return_value = self.mock_llm
        self.mock_llm.with_structured_output.return_value = self.mock_llm

        # Add the __pregel_runtime attribute to avoid KeyError
        self.mock_llm.__pregel_runtime = {}

        # Create a mock response
        self.mock_response = MagicMock()
        self.mock_response.content = (
            "<einfachesprache>Simplified test content</einfachesprache>"
        )
        self.mock_llm.invoke.return_value = self.mock_response

        # Create the ToolCollection instance
        self.chat_tools = ToolCollection(model=self.mock_llm)

    @patch("builtins.open", new_callable=mock_open, read_data="Test system message")
    def test_simplify_tool_with_file_loading(self, mock_file, mock_stream_writer):
        """Test the simplify tool with mocked file operations"""
        # Configure mock stream writer to return a do-nothing function
        mock_stream_writer.return_value = lambda x: None

        # Call the simplify tool
        result = self.chat_tools.simplify.invoke({"text": "Some complex text."})

        # Verify LLM was configured with expected parameters
        self.mock_llm.with_config.assert_called_with(
            {"llm_temperature": 0.3, "llm_streaming": False, "llm_max_tokens": 1500}
        )

        # Verify LLM was invoked with messages
        self.mock_llm.invoke.assert_called_once()

        # Verify the result is as expected
        assert result == "Simplified test content"

        # Verify file operations were attempted
        assert mock_file.call_count > 0

    def test_brainstorm_tool(self, mock_stream_writer):
        """Test the brainstorm tool functionality"""
        # Configure mock stream writer to return a do-nothing function
        mock_stream_writer.return_value = lambda x: None

        # Setup a specific response for brainstorm tool
        self.mock_response.content = (
            "```markdown\n# Test Topic\n\n## Main Point 1\n\n- Subpoint 1\n```"
        )

        # Call the brainstorm tool
        result = self.chat_tools.brainstorm.invoke(
            {"topic": "TestTopic", "context": "TestContext"}
        )

        # Verify LLM was configured with expected parameters
        self.mock_llm.with_config.assert_called_with(
            {"llm_temperature": 0.8, "llm_max_tokens": 2000, "llm_streaming": False}
        )

        # Verify LLM was invoked with messages
        self.mock_llm.invoke.assert_called_once()

        # Verify that the result is correctly formatted
        assert "# Test Topic" in result

    def test_get_tools_list(self, mock_stream_writer):
        """Test that get_tools returns the expected list of tools"""
        tool_list = self.chat_tools.get_tools()

        # Verify we get a list with two tools
        assert isinstance(tool_list, list)
        assert len(tool_list) == 3

        # Verify both tools are callable
        assert callable(tool_list[0])
        assert callable(tool_list[1])

    @patch("builtins.open", side_effect=FileNotFoundError)
    def test_fallback_prompts(self, mock_file, mock_stream_writer):
        """Test that fallback prompts are used when files aren't found"""
        # Configure mock stream writer to return a do-nothing function
        mock_stream_writer.return_value = lambda x: None

        # Call the simplify tool which will try to load files
        result = self.chat_tools.simplify.invoke({"text": "Some complex text."})

        # Verify the result still works using fallbacks
        assert result == "Simplified test content"

    def test_add_instructions(self, mock_stream_writer):
        """Test that add_instructions properly updates messages with tool information"""
        from langchain_core.tools import tool

        # Create a real test tool using the decorator
        @tool(description="A test tool")
        def test_tool():
            pass

        # Create a list of messages
        messages = [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="Hello"),
        ]

        # Add instructions
        updated = self.chat_tools.add_instructions(messages, [test_tool])

        # Verify instructions were added to the system message
        assert "You are a helpful assistant." in updated[0].content
        assert "You have access to the following tools:" in updated[0].content
        assert "- test_tool: A test tool" in updated[0].content

        # Test with no system message
        messages = [HumanMessage(content="Hello")]
        updated = self.chat_tools.add_instructions(messages, [test_tool])

        # Verify a system message was inserted
        assert isinstance(updated[0], SystemMessage)
        assert "You have access to the following tools:" in updated[0].content

        # Test with empty tools list
        messages = [SystemMessage(content="You are a helpful assistant.")]
        updated = self.chat_tools.add_instructions(messages, [])

        # Verify no changes
        assert updated == messages
