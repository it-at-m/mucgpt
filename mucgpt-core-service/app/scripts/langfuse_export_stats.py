"""Usage statistics from a Langfuse *trace* export (JSONL), fully offline.

Run from mucgpt-core-service:
    uv run python app/scripts/langfuse_export_stats.py path/to/lf-traces-export.jsonl
    uv run python app/scripts/langfuse_export_stats.py export.jsonl --top 10

Counting rules:
- A chat request is one trace named ``Agent`` (root observation of a chat run).
- Excluded entirely: ``chat-title-generation`` and ``assistant-compliance-check``.
  ``Completion`` traces (core releases before 0.17.3, i.e. until ~15.09.2026) are the
  old chat-title generation via non-streaming ``/v1/chat/completions`` and are therefore
  not chat requests either; ``assistant-draft-generation`` and blank-name traces are
  ignored as well.
- A chat session is a distinct ``sessionId`` on Agent traces. Session IDs exist only
  since release 0.17.3 (first seen 2026-09-15); requests without one are reported as
  "pre-session" requests.
- The assistant comes from ``metadata.assistant_id``, else the ``default-assistant`` tag,
  else a UUID-shaped ``assistant-<uuid>`` tag.
- Months are UTC calendar months. User IDs are the hashed IDs from the export.
"""

import argparse
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

CHAT_REQUEST = "Agent"
EXCLUDED = {"chat-title-generation", "assistant-compliance-check"}
DEFAULT_ASSISTANT = "default-assistant"
ASSISTANT_TAG = re.compile(
    r"^assistant-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$"
)


def assistant_of(record: dict) -> str:
    assistant_id = (record.get("metadata") or {}).get("assistant_id")
    if assistant_id:
        return assistant_id
    for tag in record.get("tags") or []:
        if tag == DEFAULT_ASSISTANT:
            return DEFAULT_ASSISTANT
        match = ASSISTANT_TAG.match(tag)
        if match:
            return match.group(1)
    return "unknown"


def fmt(n: float) -> str:
    return f"{n:,.0f}".replace(",", ".")


def pct(part: int, total: int) -> str:
    return f"{100 * part / total:.1f} %" if total else "-"


def split_default(counter: Counter) -> tuple[int, int, int]:
    """Return (default, custom, distinct custom assistants)."""
    custom = {
        k: v for k, v in counter.items() if k not in (DEFAULT_ASSISTANT, "unknown")
    }
    return counter[DEFAULT_ASSISTANT], sum(custom.values()), len(custom)


def analyze(path: Path, top: int) -> None:
    seen_ids: set[str] = set()
    trace_names: Counter = Counter()
    requests_by_month: Counter = Counter()
    users_by_month: dict[str, set[str]] = defaultdict(set)
    users: set[str] = set()
    first_ts = last_ts = None
    # sessionId -> [first timestamp, request count, assistants]
    sessions: dict[str, list] = {}
    pre_requests: Counter = Counter()
    pre_users: dict[str, set[str]] = defaultdict(set)
    duplicates = 0

    with path.open("rb") as f:
        for line in f:
            if not line.strip():
                continue
            record = json.loads(line)
            if record["id"] in seen_ids:
                duplicates += 1
                continue
            seen_ids.add(record["id"])
            name = record.get("name") or ""
            trace_names[name] += 1
            if name != CHAT_REQUEST:
                continue

            ts = record["timestamp"]
            month = ts[:7]
            first_ts = ts if first_ts is None or ts < first_ts else first_ts
            last_ts = ts if last_ts is None or ts > last_ts else last_ts
            requests_by_month[month] += 1
            user = record.get("userId")
            if user:
                users.add(user)
                users_by_month[month].add(user)

            assistant = assistant_of(record)
            session_id = record.get("sessionId")
            if session_id:
                session = sessions.setdefault(session_id, [ts, 0, set()])
                session[0] = min(session[0], ts)
                session[1] += 1
                session[2].add(assistant)
            else:
                pre_requests[assistant] += 1
                if user:
                    pre_users[assistant].add(user)

    total_requests = sum(requests_by_month.values())
    print(f"Source: {path.name}")
    print(
        f"Agent traces from {first_ts} to {last_ts} (UTC); duplicate trace IDs skipped: {duplicates}"
    )
    print(
        "\nTrace names (excluded: "
        + ", ".join(sorted(EXCLUDED))
        + "; only 'Agent' counts as request):"
    )
    for name, count in trace_names.most_common():
        print(f"  {name or '<blank>':32} {fmt(count):>10}")

    print("\n== Overview ==")
    print(f"Chat requests:            {fmt(total_requests)}")
    print(f"Unique users:             {fmt(len(users))}")
    turns = [s[1] for s in sessions.values()]
    in_sessions = sum(turns)
    print(
        f"Chat sessions:            {fmt(len(sessions))}  (first: {min((s[0] for s in sessions.values()), default='-')})"
    )
    if sessions:
        single = sum(1 for t in turns if t == 1)
        print(f"Requests in sessions:     {fmt(in_sessions)}")
        print(
            f"Avg requests / session:   {in_sessions / len(sessions):.2f} (median {statistics.median(turns):g}, single-request sessions {pct(single, len(sessions))})"
        )

    print("\n== Monthly (UTC) ==")
    sessions_by_month = Counter(s[0][:7] for s in sessions.values())
    print(f"  {'month':8} {'requests':>10} {'users':>8} {'new sessions':>13}")
    for month in sorted(requests_by_month):
        print(
            f"  {month:8} {fmt(requests_by_month[month]):>10} {fmt(len(users_by_month[month])):>8} {fmt(sessions_by_month[month]):>13}"
        )
    print(
        "  (first/last month may be partial; monthly users overlap and must not be summed)"
    )

    pre_total = sum(pre_requests.values())
    default, custom, distinct = split_default(pre_requests)
    print("\n== Assistants: requests without session (pre-session period) ==")
    print(
        f"Requests: {fmt(pre_total)} | default {fmt(default)} ({pct(default, pre_total)}) | custom {fmt(custom)} ({pct(custom, pre_total)}) across {fmt(distinct)} assistants"
    )
    for assistant, count in pre_requests.most_common(top):
        print(
            f"  {assistant:40} {fmt(count):>9} requests  {fmt(len(pre_users[assistant])):>6} users"
        )

    session_assistants: Counter = Counter()
    for session in sessions.values():
        for assistant in session[2]:
            session_assistants[assistant] += 1
    multi = sum(1 for s in sessions.values() if len(s[2]) > 1)
    default, custom, distinct = split_default(session_assistants)
    print("\n== Assistants: chat sessions ==")
    print(
        f"Sessions: {fmt(len(sessions))} | default {fmt(default)} ({pct(default, len(sessions))}) | custom {fmt(custom)} ({pct(custom, len(sessions))}) across {fmt(distinct)} assistants"
    )
    print(f"  ({multi} sessions use several assistants and are counted for each)")
    for assistant, count in session_assistants.most_common(top):
        print(f"  {assistant:40} {fmt(count):>9} sessions")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("export", type=Path, help="Langfuse trace export (JSONL)")
    parser.add_argument(
        "--top",
        type=int,
        default=5,
        help="number of top assistants to list (default: 5)",
    )
    args = parser.parse_args()
    analyze(args.export, args.top)


if __name__ == "__main__":
    main()
