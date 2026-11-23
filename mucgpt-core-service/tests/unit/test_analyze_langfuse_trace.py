from types import SimpleNamespace

from scripts.analyze_langfuse_trace import _find_finish_reason, _observation_lines


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


def test_observation_lines_hide_status_message_without_content() -> None:
    observation = SimpleNamespace(
        type="TOOL",
        name="search",
        level="ERROR",
        status_message="Sensitive status details",
    )

    lines = list(
        _observation_lines(observation, show_content=False, max_content_chars=80)
    )

    assert lines == ["- TOOL       search level=ERROR"]


def test_observation_lines_show_status_message_with_content() -> None:
    observation = SimpleNamespace(
        type="TOOL",
        name="search",
        level="ERROR",
        status_message="Search completed",
    )

    lines = list(
        _observation_lines(observation, show_content=True, max_content_chars=80)
    )

    assert lines == ["- TOOL       search level=ERROR status=Search completed"]
