"""Sanitization of assistant messages for strict OpenAI-compatible APIs."""

from langchain_core.messages import AIMessage, ToolCall

from agent.middleware import _normalize_assistant_messages


def test_drops_assistant_message_without_content_and_tool_calls():
    messages = [
        AIMessage(content="hi"),
        AIMessage(content=""),
    ]
    normalized = _normalize_assistant_messages(messages)
    assert len(normalized) == 1
    assert normalized[0].content == "hi"


def test_flattens_content_block_lists_from_reasoning_models():
    # Reasoning models return thinking blocks next to tool calls; Mistral's
    # API rejects list-typed assistant content ("Input should be a valid
    # string").
    tool_call = ToolCall(name="canvas_write", args={"content": "x"}, id="c1")
    message = AIMessage(
        content=[{"type": "thinking", "thinking": "hmm"}, {"type": "text", "text": ""}],
        tool_calls=[tool_call],
    )
    normalized = _normalize_assistant_messages([message])
    assert len(normalized) == 1
    assert normalized[0].content == ""
    # the tool call survives — the call itself must still run
    assert normalized[0].tool_calls[0]["name"] == "canvas_write"


def test_joins_multiple_text_blocks():
    message = AIMessage(
        content=[
            {"type": "text", "text": "Teil 1. "},
            {"type": "text", "text": "Teil 2"},
        ]
    )
    normalized = _normalize_assistant_messages([message])
    assert normalized[0].content == "Teil 1. Teil 2"


def test_plain_string_messages_pass_through_unchanged():
    messages = [AIMessage(content="hello"), AIMessage(content="")]
    result = _normalize_assistant_messages(messages)
    assert len(result) == 1
    assert result[0].content == "hello"


def test_returns_original_list_when_nothing_changed():
    messages = [AIMessage(content="hello")]
    result = _normalize_assistant_messages(messages)
    assert result is messages
