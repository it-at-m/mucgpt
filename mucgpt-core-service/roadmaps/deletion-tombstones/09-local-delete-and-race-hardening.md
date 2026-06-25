# 09 — Local delete stays deleted (no re-pull race)

**Milestone:** M3 — Frontend  ·  **Depends on:** 08  ·  **Size:** S  ·  **Action points:** 3

## Context
`deleteEntry` already deletes locally then mirrors to the backend
(`deleteConversation(id).catch(...)`). With soft-delete the backend keeps a
tombstone, so the remaining risk is a *local* race: a concurrent `runSync` that
already fetched the old `backendList` could re-pull the just-deleted chat before
its tombstone is visible, briefly resurrecting it in IndexedDB.

## Scope
**In:** make the local delete authoritative against an in-flight sync. **Out:**
backend semantics (already handled by tombstone + 409).

## Implementation (3 action points)
1. In `deleteEntry`, await the backend mirror (it's already a tombstone write) and,
   on success, invalidate the `syncPromise` guard (`this.syncPromise = null`) so the
   next `getAllHistoryEntries` re-syncs against fresh state including the new
   tombstone — rather than reusing a resolved promise built from pre-delete data.
2. Guard the pull path against a deletion that lands mid-sync: in `runSync`'s pull
   branch, before `chatStorage.create(...)`, re-check the chat isn't in `deletedIds`
   (recomputed from the tombstone fetch in step 08) — so a chat deleted during the
   sync window isn't pulled back.
3. Keep the backend mirror best-effort but **logged**: if `deleteConversation`
   fails, the local chat is already gone, and the next successful sync's tombstone
   fetch won't list it (the backend still has it live) — note this gap so step 10/11
   tests cover "backend mirror failed, chat still deleted locally, reappears on next
   sync" as the accepted degraded behavior (no data loss, just a reappearance the
   user can re-delete).

## Acceptance criteria
- Deleting a chat does not let an in-flight sync resurrect it locally.
- After a successful backend mirror, the chat stays gone across refreshes/devices.
- The degraded path (mirror failed) is documented and bounded (reappear-then-redelete,
  never silent data loss).

## Notes
This step is deliberately small — most of the durability comes from the backend
tombstone (02–03) and the apply-deletions sync (08). It only closes the local
timing window between "deleted here" and "tombstone visible there".
