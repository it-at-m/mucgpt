# 03 — Optimistic-concurrency precondition in the repository

**Milestone:** M1 — Backend foundation  ·  **Depends on:** 02  ·  **Size:** M  ·  **Action points:** 3

## Context
The actual guard: when a client supplies the revision its history is based on,
`replace_messages` must refuse to overwrite if the stored revision has moved on.
This is the step that prevents last-write-wins data loss.

## Scope
**In:** optional `expected_revision` param + mismatch → raise a typed error.
**Out:** HTTP mapping (05), streaming (06), client behavior (09).

## Implementation (3 action points)
1. Define a `ConflictError(Exception)` (e.g. in `database/conversation_repo.py`
   or a small `database/errors.py`) carrying `current_revision` and
   `expected_revision`.
2. `replace_messages(..., expected_revision: int | None = None)` — after loading
   the owned conversation and **before** clearing/re-inserting: if
   `expected_revision is not None and conversation.revision != expected_revision`,
   raise `ConflictError(current=conversation.revision, expected=expected_revision)`.
   When `expected_revision is None`, behave exactly as today (backward-compatible).
3. Ensure the check reads a fresh value: rely on the row already loaded in this
   transaction; document that the DB isolation level (READ COMMITTED on Postgres)
   plus the single-statement write make a stale read-then-overwrite window
   negligible, and that the unique-sequence retry (PR #1067) covers the residual.

## Acceptance criteria
- Mismatched `expected_revision` raises `ConflictError` and writes nothing.
- Matching or absent `expected_revision` applies the write (and bumps revision).
- Cross-user ownership behavior is unchanged (still returns `None`).

## Notes
Keep `ConflictError` distinct from `IntegrityError`: the latter is the
sequence-collision retry (intra-conversation), the former is the cross-client
precondition failure (inter-client). They surface differently (retry vs 409).
