# 011 - Regression Test Suite And Go-Live Gate

## Goal

Stage 3, step 4 — the gate. Nothing in Stage 4 starts until this issue is
closed.

## Implementation

- Update/unskip the streaming and tool-call chunk-shape tests in
  `tests/unit/test_agent_executor.py` (content deltas, tool-call delta
  shape, `finish_reason == "stop"`, the non-streaming error contract).
- Re-verify `test_init_app.py` construction and `ModelOptions`
  temperature-validation contracts against the new wiring.
- Add coverage for `008`'s node-filtering logic and `004`'s recursion-limit
  bound.
- Run the full existing test suite (`uv run pytest`) and confirm zero
  regressions — not just the agent-specific tests.
- Manually exercise the chat UI (start the stack, or `npm run dev` against
  a running core-service) for: a plain chat turn, an Atlassian-scoped turn,
  a data-sources turn, and a `Simplify`/`Brainstorming` tool turn — confirm
  nothing looks different to a user.

## Acceptance Criteria

- All automated tests green.
- Manual UI pass produces no observable difference from pre-migration
  behavior for all four scenarios above.

## Tests

- As above — this issue's entire content is test/verification work, no new
  production code.

## Reviewer Notes

- Treat a "looks the same but I didn't actually run it" review as
  insufficient here — this is the issue that turns the whole backlog's
  promise ("integrated without disrupting prod functionality") from a claim
  into something verified. Stage 4 issues (`012`–`016`) should be blocked
  in whatever tracker is used until this is marked done.
