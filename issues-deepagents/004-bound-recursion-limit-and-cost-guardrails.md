# 004 - Bound Recursion Limit And Cost Guardrails

## Goal

Stage 1, step 4. Close a gap in the original migration proposal (issue
#1147 / CodeRabbit's plan): `create_deep_agent` compiles its graph with
`.with_config({"recursion_limit": 9_999, ...})` by default — sized for long
autonomous agent runs, not a synchronous, streamed, per-request chat turn.

## Implementation

- Confirm the default recursion limit the installed `deepagents` version
  actually applies (verify against source — this library moves fast and
  the exact default could change between versions).
- Decide and document a bounded override appropriate for MUCGPT's
  request/response chat pattern (matched to today's effective ReAct loop's
  practical bound, not 9999), applied via the same per-request `config`
  merge (`merge_configs`) `agent_executor.py` already uses for other
  overrides.
- Confirm no separate wall-clock/cost guard is needed beyond the existing
  request timeout — if one is, note it here rather than silently
  inheriting deepagents' default.

## Acceptance Criteria

- A concrete recursion-limit value (not the deepagents default) is decided
  and documented, with reasoning for the chosen number.
- The override is verified to actually take effect (not silently
  overridden back by `create_deep_agent`'s own `.with_config` call).

## Tests

- A test invoking a pathological tool-loop scenario (e.g., a tool that
  always triggers another tool call) confirms the graph stops at the
  configured limit, not at 9999.

## Reviewer Notes

- Small, but easy to silently skip — call this out explicitly when
  reviewing `006`, since a missed override only shows up in production
  under an adversarial or buggy tool-calling loop, never in normal testing.
