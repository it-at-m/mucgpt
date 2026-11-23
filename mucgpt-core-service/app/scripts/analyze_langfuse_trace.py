"""Print a concise diagnostic timeline for one Langfuse trace.

Loads LANGFUSE_* from the process environment first, then from stack/.env when
available. Content is redacted by default; pass --show-content when the trace
may be printed safely in the current environment.
"""

import argparse
import os
import sys
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from dotenv import load_dotenv
from langfuse import Langfuse
from truststore import inject_into_ssl

_DEFAULT_ENV_PATH = Path(__file__).resolve().parents[3] / "stack" / ".env"
_FILTER_FINISH_REASONS = {"content_filter", "content_policy_violation"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print a diagnostic timeline for a Langfuse trace."
    )
    parser.add_argument("trace_id", help="Langfuse trace ID")
    parser.add_argument(
        "--api-version",
        choices=("v4", "v3"),
        default="v3",
        help=(
            "Langfuse API version: v4 uses Observations API v2; v3 uses the "
            "legacy trace endpoint for self-hosted v3 (default: v3)"
        ),
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=_DEFAULT_ENV_PATH,
        help="Optional dotenv file containing LANGFUSE_* credentials",
    )
    parser.add_argument(
        "--show-content",
        action="store_true",
        help="Include bounded input and output content in the report",
    )
    parser.add_argument(
        "--max-content-chars",
        type=int,
        default=500,
        help="Maximum characters printed per input/output value (default: 500)",
    )
    parser.add_argument(
        "--from-start-time",
        type=_parse_datetime,
        help="Inclusive v4 observation window start (ISO-8601; default: 7 days ago)",
    )
    parser.add_argument(
        "--to-start-time",
        type=_parse_datetime,
        help="Exclusive v4 observation window end (ISO-8601; default: now)",
    )
    return parser.parse_args()


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("datetime must include a timezone")
    return parsed


def _load_environment(env_file: Path) -> None:
    if env_file.is_file():
        load_dotenv(env_file, override=False)

    required = ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_HOST")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Missing Langfuse configuration: "
            f"{', '.join(missing)}. Set it in the environment or {env_file}."
        )

    # The Compose file may refer to a container-only CA bundle. Let truststore
    # use the local platform certificate store when that file is unavailable.
    cert_file = os.getenv("SSL_CERT_FILE")
    if cert_file and not Path(cert_file).is_file():
        os.environ.pop("SSL_CERT_FILE")
    inject_into_ssl()


def _compact(value: Any, limit: int) -> str:
    text = str(value).replace("\n", "\\n")
    return text if len(text) <= limit else f"{text[:limit]}..."


def _metadata(observation: Any) -> dict[str, Any]:
    metadata = getattr(observation, "metadata", None)
    return metadata if isinstance(metadata, dict) else {}


def _model_name(observation: Any) -> str | None:
    metadata = _metadata(observation)
    return (
        getattr(observation, "model", None)
        or metadata.get("ls_model_name")
        or metadata.get("model_name")
    )


def _find_finish_reason(value: Any) -> str | None:
    reasons = list(_finish_reasons(value))
    return next(
        (reason for reason in reasons if reason in _FILTER_FINISH_REASONS),
        reasons[0] if reasons else None,
    )


def _finish_reasons(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        metadata = value.get("response_metadata")
        if isinstance(metadata, dict) and (reason := metadata.get("finish_reason")):
            yield str(reason)
        for nested_value in value.values():
            yield from _finish_reasons(nested_value)
    elif isinstance(value, list):
        for nested_value in value:
            yield from _finish_reasons(nested_value)


def _observation_lines(
    observation: Any, *, show_content: bool, max_content_chars: int
) -> Iterable[str]:
    observation_type = str(getattr(observation, "type", "unknown"))
    name = getattr(observation, "name", "unknown")
    level = getattr(observation, "level", "DEFAULT")
    duration = ""
    start_time = getattr(observation, "start_time", None)
    end_time = getattr(observation, "end_time", None)
    if start_time and end_time:
        duration = f" duration={end_time - start_time}"

    details = [f"{observation_type:<10} {name}"]
    if getattr(level, "value", level) != "DEFAULT":
        details.append(f"level={level}")
    if model := _model_name(observation):
        details.append(f"model={model}")
    if reason := _find_finish_reason(getattr(observation, "output", None)):
        details.append(f"finish_reason={reason}")
        if reason in _FILTER_FINISH_REASONS:
            details.append("CONTENT_FILTERED")
    if show_content and (
        status_message := getattr(observation, "status_message", None)
    ):
        details.append(f"status={_compact(status_message, max_content_chars)}")
    yield f"- {' '.join(details)}{duration}"

    if show_content:
        for label in ("input", "output"):
            value = getattr(observation, label, None)
            if value is not None:
                yield f"  {label}: {_compact(value, max_content_chars)}"


def _trace_from_observations(trace_id: str, observations: list[Any]) -> Any:
    observations = sorted(
        observations,
        key=lambda observation: getattr(observation, "start_time", None) or "",
    )
    root = next(
        (
            observation
            for observation in observations
            if getattr(observation, "parent_observation_id", None) is None
        ),
        None,
    )
    name = next(
        (
            getattr(observation, "trace_name", None)
            for observation in observations
            if getattr(observation, "trace_name", None)
        ),
        getattr(root, "name", None),
    )
    return SimpleNamespace(
        id=trace_id,
        name=name,
        timestamp=(
            getattr(observations[0], "start_time", None) if observations else None
        ),
        observations=observations,
    )


def _get_v4_trace(
    client: Any,
    trace_id: str,
    *,
    from_start_time: datetime,
    to_start_time: datetime,
) -> Any:
    observations: list[Any] = []
    cursor = None
    while True:
        page = client.api.observations.get_many(
            trace_id=trace_id,
            fields="core,basic,io,metadata,model,trace_context",
            from_start_time=from_start_time,
            to_start_time=to_start_time,
            limit=1000,
            cursor=cursor,
        )
        observations.extend(page.data)
        cursor = getattr(getattr(page, "meta", None), "cursor", None)
        if not cursor:
            break
    return _trace_from_observations(trace_id, observations)


def _get_trace(
    trace_id: str,
    *,
    api_version: str,
    from_start_time: datetime,
    to_start_time: datetime,
) -> Any:
    client = Langfuse()
    if api_version == "v3":
        return client.api.trace.get(trace_id)
    return _get_v4_trace(
        client,
        trace_id,
        from_start_time=from_start_time,
        to_start_time=to_start_time,
    )


def analyze_trace(
    trace_id: str,
    *,
    api_version: str = "v4",
    from_start_time: datetime | None = None,
    to_start_time: datetime | None = None,
    show_content: bool,
    max_content_chars: int,
) -> None:
    to_start_time = to_start_time or datetime.now(UTC)
    from_start_time = from_start_time or to_start_time - timedelta(days=7)
    if from_start_time >= to_start_time:
        raise ValueError("--from-start-time must be before --to-start-time")
    trace = _get_trace(
        trace_id,
        api_version=api_version,
        from_start_time=from_start_time,
        to_start_time=to_start_time,
    )
    observations = sorted(
        trace.observations,
        key=lambda observation: getattr(observation, "start_time", None) or "",
    )

    print(f"Trace: {trace.id}")
    print(f"Name: {getattr(trace, 'name', None) or '-'}")
    print(f"Started: {getattr(trace, 'timestamp', None) or '-'}")
    print(f"Observations: {len(observations)}")
    print("Timeline:")
    for observation in observations:
        print(
            *list(
                _observation_lines(
                    observation,
                    show_content=show_content,
                    max_content_chars=max_content_chars,
                )
            ),
            sep="\n",
        )


def main() -> None:
    args = parse_args()
    if args.max_content_chars < 1:
        raise ValueError("--max-content-chars must be at least 1")
    _load_environment(args.env_file)
    analyze_trace(
        args.trace_id,
        api_version=args.api_version,
        from_start_time=args.from_start_time,
        to_start_time=args.to_start_time,
        show_content=args.show_content,
        max_content_chars=args.max_content_chars,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Trace analysis failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
