# 11 — Frontend tests

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 08, 09  ·  **Size:** M  ·  **Action points:** 3

## Context
Cover the deletion-sync flow and prove the resurrection loop is gone. Match the
existing Vitest setup and mock the conversation + tombstone-feed APIs (step 07).

## Scope
**In:** unit tests for apply-deletions, no-resurrect push filter, and local-delete
race. **Out:** backend (10).

## Implementation (3 action points)
1. Apply-deletions: seed IndexedDB with a chat, mock the tombstone feed to return
   that id, run `runSync`, assert the chat is removed from `chatStorage` and the
   list no longer shows it.
2. No-resurrection: seed a local chat that is **not** in `backendList` but **is** in
   the tombstone feed; assert `runSync` does **not** call `createConversation` for
   it (the regression test for the original bug).
3. Local delete: `deleteEntry` removes the chat locally, mirrors to the backend, and
   the next `getAllHistoryEntries` (fresh sync) does not bring it back; cover the
   degraded path (mocked backend mirror failure) per step 09's accepted behavior.

## Acceptance criteria
- New tests pass; `npm run lint` (prettier + eslint + tsc) clean on touched files.
- The "deleted chat reappears after sync" scenario fails *without* the step-08 fix
  and passes with it (true regression coverage).

## Notes
Write test 2 so it would have caught the original resurrection: a chat absent from
the backend list is normally pushed — the assertion is that the tombstone overrides
that and suppresses the push.
