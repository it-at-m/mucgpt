from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import scripts.analyze_langfuse_trace as trace_script
from scripts.analyze_langfuse_trace import (
    _find_finish_reason,
    _get_trace,
    _get_v4_trace,
    _observation_lines,
    _trace_from_observations,
)


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


def test_v4_trace_retrieval_follows_observation_cursor() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    first = SimpleNamespace(
        trace_id="trace-1",
        trace_name="Example",
        name="root",
        parent_observation_id=None,
        start_time=start,
    )
    second = SimpleNamespace(
        trace_id="trace-1",
        trace_name="Example",
        name="child",
        parent_observation_id="observation-1",
        start_time=start,
    )

    class Observations:
        def __init__(self) -> None:
            self.cursors: list[str | None] = []

        def get_many(self, **kwargs: Any) -> object:
            self.cursors.append(kwargs["cursor"])
            if len(self.cursors) == 1:
                return SimpleNamespace(
                    data=[first], meta=SimpleNamespace(cursor="next")
                )
            return SimpleNamespace(data=[second], meta=SimpleNamespace(cursor=None))

    observations = Observations()
    client = SimpleNamespace(api=SimpleNamespace(observations=observations))

    trace = _get_v4_trace(
        client,
        "trace-1",
        from_start_time=start,
        to_start_time=start.replace(day=2),
    )

    assert observations.cursors == [None, "next"]
    assert trace.id == "trace-1"
    assert trace.name == "Example"
    assert trace.observations == [first, second]


def test_trace_from_observations_uses_root_name_without_trace_name() -> None:
    observation = SimpleNamespace(
        name="root operation",
        parent_observation_id=None,
        start_time=datetime(2026, 1, 1, tzinfo=UTC),
    )

    trace = _trace_from_observations("trace-1", [observation])

    assert trace.name == "root operation"


def test_v3_trace_retrieval_uses_legacy_trace_endpoint(monkeypatch: Any) -> None:
    expected = SimpleNamespace(id="trace-1", observations=[])

    class Trace:
        def get(self, trace_id: str) -> object:
            assert trace_id == "trace-1"
            return expected

    client = SimpleNamespace(api=SimpleNamespace(trace=Trace()))
    monkeypatch.setattr(trace_script, "Langfuse", lambda: client)

    trace = _get_trace(
        "trace-1",
        api_version="v3",
        from_start_time=datetime(2026, 1, 1, tzinfo=UTC),
        to_start_time=datetime(2026, 1, 2, tzinfo=UTC),
    )

    assert trace is expected
