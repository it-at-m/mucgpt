from unittest.mock import MagicMock, mock_open, patch

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from chat.tools import ToolCollection


class TestChatTools:
    def setup_method(self):
        """Setup test fixtures before each test method"""
        # Create a mock LLM
        self.mock_llm = MagicMock()
        self.mock_llm.with_config.return_value = self.mock_llm

        # Create a mock response
        self.mock_response = MagicMock()
        self.mock_response.content = (
            "<einfachesprache>Simplified test content</einfachesprache>"
        )
        self.mock_llm.invoke.return_value = self.mock_response

        # Create the ChatTools instance
        self.chat_tools = ToolCollection(self.mock_llm)

    @patch("builtins.open", new_callable=mock_open, read_data="Test system message")
    def test_simplify_tool_with_file_loading(self, mock_file):
        """Test the simplify tool with mocked file operations"""
        # Call the simplify tool
        result = self.chat_tools.simplify.invoke(
            {"text": "Some complex text.", "target_audience": "experts"}
        )

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

    def test_brainstorm_tool(self):
        """Test the brainstorm tool functionality"""
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

        # Verify that the markdown content was extracted correctly
        assert result == "# Test Topic\n\n## Main Point 1\n\n- Subpoint 1"

    @patch("chat.tools.ToolCollection._extract_text")
    def test_simplify_tool_extraction(self, mock_extract):
        """Test that the simplify tool correctly extracts text"""
        # Setup the mock extraction function
        mock_extract.return_value = "Extracted text"

        # Call the simplify tool
        result = self.chat_tools.simplify.invoke(
            {"text": "Some complex text.", "target_audience": "general"}
        )

        # Verify extract_text was called with the correct response content
        mock_extract.assert_called_once_with(self.mock_response.content)

        # Verify the result is the extracted text
        assert result == "Extracted text"

    def test_extract_text_method(self):
        """Test the _extract_text method directly"""
        # Sample response with embedded content
        sample_response = (
            "before <einfachesprache>extracted content</einfachesprache> after"
        )

        # Call the method directly
        result = self.chat_tools._extract_text(sample_response)

        # Verify extraction works as expected
        assert result == "extracted content"

    def test_cleanup_mindmap(self):
        """Test the _cleanup_mindmap method"""
        # Test with markdown code block
        markdown = "Here's your mindmap:\n\n```markdown\n# Topic\n## Subtopic\n```"
        result = self.chat_tools._cleanup_mindmap(markdown)
        assert result == "# Topic\n## Subtopic"

        # Test with just markdown language identifier
        markdown = "```markdown\n# Topic\n```"
        result = self.chat_tools._cleanup_mindmap(markdown)
        assert result == "# Topic"

        # Test with no code block
        markdown = "# Topic\n## Subtopic"
        result = self.chat_tools._cleanup_mindmap(markdown)
        assert result == "# Topic\n## Subtopic"

    def test_get_tools_list(self):
        """Test that get_tools returns the expected list of tools"""
        tool_list = self.chat_tools.get_tools()

        # Verify we get a list with two tools
        assert isinstance(tool_list, list)
        assert len(tool_list) == 3

        # Verify both tools are callable
        assert callable(tool_list[0])
        assert callable(tool_list[1])

    @patch("builtins.open", side_effect=FileNotFoundError)
    def test_fallback_prompts(self, mock_file):
        """Test that fallback prompts are used when files aren't found"""
        # Call the simplify tool which will try to load files
        result = self.chat_tools.simplify.invoke(
            {"text": "Some complex text.", "target_audience": "general"}
        )

        # Verify the result still works using fallbacks
        assert result == "Simplified test content"

        # Test fallback methods directly
        fallback_rules = self.chat_tools._get_fallback_rules()
        assert "Wortebene" in fallback_rules

        fallback_prompt = self.chat_tools._get_fallback_prompt()
        assert "{rules}" in fallback_prompt
        assert "{message}" in fallback_prompt

    def test_add_instructions(self):
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


if __name__ == "__main__":
    pytest.main([__file__])
