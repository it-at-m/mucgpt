# 02 — Soft-delete in the repository; reads exclude tombstones

**Milestone:** M1 — Backend foundation  ·  **Depends on:** 01  ·  **Size:** M  ·  **Action points:** 3

## Context
`ConversationRepository` currently hard-deletes (`session.delete`) and its reads
(`list_for_user`, `get_for_user`) assume every row is live. Switching to tombstones
means delete stamps `deleted_at` and every read must filter tombstones out so the
rest of the system sees a deleted chat as gone.

## Scope
**In:** `delete()` → soft, `list_for_user`/`get_for_user` exclude tombstoned.
**Out:** create/resurrection guard + tombstone listing (03), API mapping (04–06).

## Implementation (3 action points)
1. `delete(conversation_id, user_id)` — instead of `session.delete`, load via
   `get_for_user`, set `conversation.deleted_at = func.now()`, `flush()`, return
   `True`; still return `False` when not found/owned. Idempotent: deleting an
   already-tombstoned chat is a no-op that returns `True` (it stays deleted).
2. `get_for_user(...)` — add `Conversation.deleted_at.is_(None)` to the `where`, so
   a tombstoned chat reads as `None` (callers already treat `None` as 404).
3. `list_for_user(...)` — add the same `deleted_at IS NULL` filter so deleted chats
   never appear in the normal list. Run `uv run pytest tests/unit/test_conversation_repo.py`.

## Acceptance criteria
- After `delete()`, the row still exists but `get_for_user`/`list_for_user` omit it.
- `delete()` is idempotent and ownership is still enforced.
- `replace_messages`/`append_message` on a tombstoned id fail closed (they go
  through `get_for_user`, which now returns `None`) — assert this in step 10.

## Notes
Keep the cascade behavior in mind: hard delete used to cascade to `messages`. Soft
delete leaves messages attached to the tombstoned row — that's fine (they're hidden
with the parent) and lets the retention sweep (step 12) remove both together later.
