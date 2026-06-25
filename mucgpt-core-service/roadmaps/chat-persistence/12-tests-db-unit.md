# 12 — DB unit tests (models + repositories)

**Milestone:** M4 — Offline test proof  ·  **Depends on:** 02, 03  ·  **Size:** M

## Context
Validate the persistence layer in isolation against in-memory SQLite — fast, no model, no
network. Pattern follows `mucgpt-assistant-service/tests` (SQLAlchemy + aiosqlite).

## Scope
**In:** unit tests for `Conversation`/`Message` models and `ConversationRepository`.
**Out:** HTTP-level tests (13).

## Implementation
1. `tests/unit/conftest.py` — `db_session` fixture: create an async engine on
   `sqlite+aiosqlite:///:memory:`, `Base.metadata.create_all`, yield a session, dispose after.
2. `tests/unit/test_conversation_repo.py`:
   - create conversation (with and without initial messages)
   - `list_for_user` ordering (updated_at desc) and ownership isolation
   - `get_for_user` eager-loads messages in `sequence` order; returns `None` cross-user
   - `append_message` → monotonic, gap-free sequences; bumps `updated_at`
   - `delete` cascades to messages; cross-user delete returns `False`
   - `update_meta` title/favorite

## Acceptance criteria
- `pytest tests/unit` passes offline.
- Ownership isolation and cascade delete are explicitly asserted.
