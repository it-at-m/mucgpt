# 10 — Backend tests

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 02, 03, 05, 06  ·  **Size:** M  ·  **Action points:** 3

## Context
Lock the tombstone contract at the repository and HTTP layers. Mirror the existing
patterns in `tests/unit/test_conversation_repo.py` and the conversations-router
integration tests.

## Scope
**In:** repo soft-delete/no-resurrect/feed unit tests + router 204/409/404 +
feed-endpoint integration. **Out:** frontend (11).

## Implementation (3 action points)
1. Repo unit (`tests/unit/test_conversation_repo.py`): `delete()` leaves the row but
   `get_for_user`/`list_for_user` omit it; `delete()` is idempotent; `create()` with
   a tombstoned id raises `ConversationDeletedError`; `replace_messages`/
   `append_message` on a tombstoned id fail closed; `list_deleted_for_user` returns
   only tombstones and honors `since`.
2. Router integration: `DELETE` returns 204 and the chat then 404s on `GET`;
   re-creating the tombstoned id via `POST` returns **409** with the conflict body
   and writes nothing.
3. Feed integration: delete two chats, `GET /conversations/deleted` returns both
   ids (ownership-scoped — another user's tombstones don't leak); `since=<cursor>`
   returns only the newer one. Run `uv run pytest` + `uv run ruff check`.

## Acceptance criteria
- All new tests pass; full suite stays green; `ruff` clean.
- Cross-user isolation is asserted on both the feed and the resurrection guard.

## Notes
Assert the resurrection guard writes nothing on 409 (no partial row) — it's the
core anti-resurrection guarantee and the analogue of #1068's "no model call on
conflict" check.
