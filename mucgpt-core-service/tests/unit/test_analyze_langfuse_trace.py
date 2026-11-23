from scripts.analyze_langfuse_trace import _find_finish_reason


def test_find_finish_reason_prefers_later_filtered_termination() -> None:
    output = [
        {"response_metadata": {"finish_reason": "tool_calls"}},
        {"response_metadata": {"finish_reason": "content_filter"}},
    ]

    assert _find_finish_reason(output) == "content_filter"


def test_find_finish_reason_preserves_first_reason_without_filter() -> None:
    output = [
        {"response_metadata": {"finish_reason": "tool_calls"}},
        {"response_metadata": {"finish_reason": "stop"}},
    ]

    assert _find_finish_reason(output) == "tool_calls"
