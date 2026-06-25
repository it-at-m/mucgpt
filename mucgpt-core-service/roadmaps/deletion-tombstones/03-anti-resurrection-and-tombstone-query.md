# 03 — Anti-resurrection on create + tombstone listing query

**Milestone:** M1 — Backend foundation  ·  **Depends on:** 02  ·  **Size:** M  ·  **Action points:** 3

## Context
The resurrection loop is closed at the source here: a client that still caches a
deleted chat must not be able to re-create it, and clients need a way to *learn*
which ids were deleted so they can drop them locally.

## Scope
**In:** create guard against tombstoned id + a `list_deleted_for_user` repo query.
**Out:** HTTP mapping of the guard (05) and the feed endpoint (06).

## Implementation (3 action points)
1. Resurrection guard in `create(...)`: before inserting with a client-supplied id,
   check whether a row with that `(id, user_id)` exists **including tombstoned**
   (a dedicated `_get_any(id, user_id)` that omits the `deleted_at IS NULL` filter).
   If it exists and is tombstoned, raise a typed `ConversationDeletedError`
   (new, in the repo module) instead of inserting. A live duplicate keeps today's
   behavior.
2. Add `async def list_deleted_for_user(self, user_id, since: datetime | None) -> list[Conversation]`:
   select rows where `deleted_at IS NOT NULL` (and `deleted_at > since` when given),
   ordered by `deleted_at`. Return enough to emit `{id, deleted_at}` tuples.
3. Unit-test both: re-creating a tombstoned id raises `ConversationDeletedError`;
   `list_deleted_for_user` returns only tombstoned ids and respects `since`.

## Acceptance criteria
- A `create` with a tombstoned id is rejected, not resurrected.
- A `create` with a brand-new id (or a live duplicate) is unaffected.
- `list_deleted_for_user` returns tombstoned ids, newest-after-`since` only.

## Notes
Use the same id for the tombstone and any future re-creation intent: the user truly
wanting that chat back is a *restore* (out of scope), not a silent re-create. The
guard intentionally forces that to surface rather than racing the sync.
