# 01 — Add `revision` column to Conversation

**Milestone:** M1 — Backend foundation  ·  **Depends on:** —  ·  **Size:** S  ·  **Action points:** 3

## Context
`Conversation` (`app/database/models.py`) has no version field. Optimistic
concurrency needs a server-owned monotonic integer to compare against the
client's expectation. The core service builds schema via
`Base.metadata.create_all` (`app/database/session.py`), which only creates
*missing tables* — it will **not** add a column to an existing `conversations`
table, so existing/Postgres deployments need an explicit migration (see step 12).

## Scope
**In:** model column + default. **Out:** incrementing it (02), conflict logic (03),
API exposure (04), prod migration SQL (12).

## Implementation (3 action points)
1. `app/database/models.py` — add to `Conversation`:
   `revision: Mapped[int] = mapped_column(Integer, server_default="0", default=0, nullable=False)`.
   Place it near `updated_at`; reuse the already-imported `Integer`.
2. Confirm fresh DBs get the column automatically: new SQLite/test DBs are built
   by `create_all`, so no test fixture change is needed. Add a one-line code
   comment that existing DBs require the step-12 migration.
3. Sanity-run the unit DB tests (`uv run pytest tests/unit/test_conversation_repo.py`)
   to confirm the model still maps and rows insert with `revision == 0`.

## Acceptance criteria
- New conversations persist with `revision = 0`.
- Existing repository/router tests stay green.
- No behavior change yet (column is inert until step 02).

## Notes
Integer (not `updated_at`) is the precondition key: exact equality is unambiguous
and immune to clock/timestamp-precision issues.
