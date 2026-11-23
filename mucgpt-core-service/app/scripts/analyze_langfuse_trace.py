"""Print a concise diagnostic timeline for one Langfuse trace.

Loads LANGFUSE_* from the process environment first, then from stack/.env when
available. Content is redacted by default; pass --show-content when the trace
may be printed safely in the current environment.
"""

import argparse
import os
import sys
from collections.abc import Iterable
from pathlib import Path
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
    return parser.parse_args()


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
    if status_message := getattr(observation, "status_message", None):
        details.append(f"status={_compact(status_message, max_content_chars)}")
    yield f"- {' '.join(details)}{duration}"

    if show_content:
        for label in ("input", "output"):
            value = getattr(observation, label, None)
            if value is not None:
                yield f"  {label}: {_compact(value, max_content_chars)}"


def analyze_trace(trace_id: str, *, show_content: bool, max_content_chars: int) -> None:
    trace = Langfuse().api.trace.get(trace_id)
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
        show_content=args.show_content,
        max_content_chars=args.max_content_chars,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Trace analysis failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
