# 10 — Backend tests

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 03, 05, 06  ·  **Size:** M  ·  **Action points:** 3

## Context
Lock in the guard at the repository and HTTP layers. Mirror the existing patterns
in `tests/unit/test_conversation_repo.py` and `tests/integration/test_chat_router.py`.

## Scope
**In:** repo conflict unit test, router 409 integration test, revision-increment
assertions. **Out:** frontend (11).

## Implementation (3 action points)
1. Repo unit (`tests/unit/test_conversation_repo.py`): `replace_messages` with a
   stale `expected_revision` raises `ConflictError` and leaves stored messages +
   revision unchanged; with a matching one it applies and bumps revision. Add an
   increment assertion to the existing append test.
2. Router integration (`tests/integration/test_chat_router.py`): a turn with a
   stale `conversation_revision` returns **409** with the conflict body, makes
   **no** model call (assert via the fake model), and persists nothing; a matching
   turn returns the new `conversation_revision`.
3. Streaming integration: a stale revision on a streaming request yields 409 before
   any SSE chunk; a successful stream ends with the `conversation.revision` event.
   Keep using the fake-model fixture from PR #1067.

## Acceptance criteria
- All new tests pass; full suite stays green; `ruff` clean.
- Backward-compat test: omitting `conversation_revision` reproduces today's
  behavior (no 409).

## Notes
Assert "no model call on conflict" explicitly — it is both a cost guarantee and
proof the reject-before-generate ordering (step 05) holds.
