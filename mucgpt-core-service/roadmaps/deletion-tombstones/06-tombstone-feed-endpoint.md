# 06 — Tombstone feed endpoint (`GET deleted ids since cursor`)

**Milestone:** M2 — API surface  ·  **Depends on:** 03, 04  ·  **Size:** M  ·  **Action points:** 3

## Context
Clients need to *learn* which ids were deleted on another device so they can drop
them locally instead of re-pushing them. This is the read side of the tombstone:
a list of `{id, deleted_at}`, optionally filtered by a `since` cursor so a client
only fetches what is new.

## Scope
**In:** new `GET /conversations/deleted` endpoint backed by `list_deleted_for_user`.
**Out:** how the frontend consumes it (08), retention/pruning (12).

## Implementation (3 action points)
1. Add `@router.get("/deleted", response_model=list[DeletedConversation])`
   `async def list_deleted_conversations(since: datetime | None = None, ...)` that
   calls `repo.list_deleted_for_user(user_info.user_id, since)` and maps rows to
   `DeletedConversation`. Register it **before** the `/{conversation_id}` route so
   `deleted` isn't captured as a conversation id by the path param.
2. Order results by `deleted_at` ascending and document that a client should
   remember the max `deleted_at` it has applied and pass it back as `since` next
   time (incremental sync). With no `since`, return all current tombstones.
3. Smoke-test via the integration client: delete two chats, `GET /deleted` returns
   both ids; pass `since=<first deleted_at>` and only the second comes back.

## Acceptance criteria
- The feed lists exactly the caller's tombstoned ids (ownership enforced).
- `since` correctly returns only tombstones newer than the cursor.
- Route ordering doesn't shadow `GET /{conversation_id}`.

## Notes
Returning ids (not full conversations) keeps the feed cheap and privacy-preserving —
a deleted chat's content never has to be re-serialized to be reconciled away.
A `since` cursor on `deleted_at` also means the feed stays small as tombstones are
pruned (step 12).
