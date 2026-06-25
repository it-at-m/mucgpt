# 08 — Apply remote deletions in `runSync`; never resurrect

**Milestone:** M3 — Frontend  ·  **Depends on:** 07  ·  **Size:** M  ·  **Action points:** 3

## Context
`unifiedHistoryStorage.ts::runSync` is the resurrection engine: it **pushes any
local chat missing from the backend**. With tombstones available, sync must first
*apply* remote deletions (drop those local chats) and must *exclude* tombstoned ids
from the push set, so a deleted chat is removed instead of re-created.

## Scope
**In:** fetch tombstones → delete locally + filter pushes. **Out:** local-delete
hardening (09), backend (01–06).

## Implementation (3 action points)
1. In `runSync`, fetch the tombstone feed alongside the existing
   `listConversations()` / `chatStorage.getAll()` (extend the `Promise.all`). Build
   a `deletedIds = new Set(tombstones.map(t => t.id))`.
2. **Apply deletions:** for every local chat whose id is in `deletedIds`, call
   `chatStorage.delete(id)` (count failures into the existing `failures` tally so a
   transient error retries on next refresh). This is how device B learns A deleted X.
3. **Don't resurrect:** change the push filter from
   `chat.id && !backendIds.has(chat.id)` to also exclude `deletedIds`
   (`&& !deletedIds.has(chat.id)`). A chat that is both locally present and
   tombstoned is deleted (step 2), never pushed. (Defense in depth: even if a push
   slipped through, the backend now rejects it with 409 from step 05.)

## Acceptance criteria
- A chat tombstoned on the backend is removed from local IndexedDB on next sync.
- No tombstoned id is ever pushed/re-created.
- Live chats still pull/push exactly as before; the `failures`-driven retry still
  works.

## Notes
Order matters: apply deletions and compute `deletedIds` **before** the push map so
the filter sees them. If you later add a `since` cursor (persist the max applied
`deleted_at` in IndexedDB/localStorage), this same code passes it to
`listDeletedConversations(since)` to keep the feed incremental.
