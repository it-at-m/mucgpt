# 05 — Delete endpoint → soft; reads + create honor tombstones

**Milestone:** M2 — API surface  ·  **Depends on:** 03, 04  ·  **Size:** M  ·  **Action points:** 3

## Context
`conversations_router.py` already calls `repo.delete` / `repo.create` /
`repo.get_for_user`. Once the repo is tombstone-aware (02–03), the router needs
only minor wiring: the delete contract stays `204`, reads stay `404`, and the
resurrection rejection maps to a clear HTTP status.

## Scope
**In:** map `ConversationDeletedError` from `create` to HTTP; confirm delete/read
behavior. **Out:** the tombstone feed endpoint (06), frontend (07–09).

## Implementation (3 action points)
1. `create_conversation`: wrap `repo.create(...)` and catch
   `ConversationDeletedError` → `raise HTTPException(status_code=409, ...)` with the
   `ConversationConflict` body. (Use **409 Conflict** rather than 410 Gone: the id
   is *taken-and-tombstoned*, and 409 reads naturally as "your create lost a race
   with a delete".) Keep `commit()` only on the success path.
2. `delete_conversation`: no signature change — `repo.delete` is now soft; still
   `204` on success, `404` when not found/owned. Confirm the existing test still
   passes with the new semantics (the row remains, but the endpoint contract is
   identical).
3. `get_conversation`: unchanged code, but now `get_for_user` returns `None` for a
   tombstone → existing `404`. Add a one-line comment that 404 covers both
   "never existed" and "deleted".

## Acceptance criteria
- Re-creating a tombstoned id returns **409** with the conflict body and writes
  nothing.
- Deleting returns 204 and the chat disappears from list/get (404 thereafter).
- Existing conversations-router tests stay green.

## Notes
404-for-tombstone is deliberate: a client asking for a chat the user deleted should
treat it as gone, not as a distinct "deleted" state. Only the dedicated feed
(step 06) exposes tombstones, and only as ids to reconcile.
