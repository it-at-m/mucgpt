# 01 — Add `deleted_at` tombstone column to Conversation

**Milestone:** M1 — Backend foundation  ·  **Depends on:** —  ·  **Size:** S  ·  **Action points:** 3

## Context
`Conversation` (`app/database/models.py`) is hard-deleted today. A tombstone needs
a durable marker that survives the "delete" so the row can be excluded from reads
yet still answer "was this deleted?". Schema is built by `Base.metadata.create_all`
(`app/database/session.py`), which only creates *missing tables* — it will **not**
add a column to an existing `conversations` table, so existing/Postgres deploys
need the explicit migration in step 12.

## Scope
**In:** model column + default. **Out:** soft-delete logic (02), anti-resurrection
(03), API exposure (04–06), prod migration SQL (12).

## Implementation (3 action points)
1. `app/database/models.py` — add to `Conversation`:
   `deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)`.
   Place it near `updated_at`; ensure `DateTime` (and `datetime`) are imported the
   same way `created_at`/`updated_at` already are.
2. Add a one-line comment that `NULL` = live and a non-null timestamp = tombstoned,
   and that existing DBs require the step-12 migration (`create_all` won't add it).
3. Sanity-run `uv run pytest tests/unit/test_conversation_repo.py` to confirm the
   model still maps and rows insert with `deleted_at IS NULL`.

## Acceptance criteria
- New conversations persist with `deleted_at = NULL`.
- Existing repository/router tests stay green.
- No behavior change yet (column is inert until step 02).

## Notes
A timestamp (not a bare `deleted` boolean) is deliberate: it records *when* so the
retention sweep in step 12 can prune old tombstones, and it sorts naturally for a
`since`-cursor tombstone feed (step 06).
