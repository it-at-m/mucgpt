# 13 — Conversations CRUD integration tests

**Milestone:** M4 — Offline test proof  ·  **Depends on:** 06  ·  **Size:** M

## Context
Exercise the conversations router through the FastAPI `TestClient`, reusing the established
override pattern in `tests/integration/conftest.py` (`authenticate_user` override +
`dependency_overrides`). No model endpoint involved — pure CRUD.

## Scope
**In:** HTTP tests for create/list/get/update/delete/append.
**Out:** chat-flow persistence (14).

## Implementation
1. Extend `tests/integration/conftest.py`:
   - Override `get_db_session` to yield a session bound to in-memory (or temp-file) SQLite with
     tables created — so each test run is isolated.
2. `tests/integration/test_conversations_router.py`:
   - `POST /v1/conversations` → 200 + body; then `GET /v1/conversations` lists it.
   - `GET /v1/conversations/{id}` returns messages in order; unknown id → 404.
   - `PATCH` updates title/favorite.
   - `POST /v1/conversations/{id}/messages` appends and returns updated detail.
   - `DELETE` → 204, subsequent `GET` → 404.
   - Cross-user: second authenticated user cannot read/delete the first user's conversation
     (override `authenticate_user` with a different `user_id` in one test).

## Acceptance criteria
- `pytest tests/integration/test_conversations_router.py` passes offline.
- Ownership (404 cross-user) asserted at the HTTP layer.
