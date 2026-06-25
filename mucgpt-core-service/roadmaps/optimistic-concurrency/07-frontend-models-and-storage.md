# 07 — Frontend models + local revision storage

**Milestone:** M3 — Frontend  ·  **Depends on:** 04  ·  **Size:** M  ·  **Action points:** 3

## Context
The client must remember the revision each chat is based on. Touch
`mucgpt-frontend/src/api/models.ts` (mirror the new fields) and the chat storage
layer (IndexedDB) that holds local chats.

## Scope
**In:** TS types + persisted revision field. **Out:** sending/receiving it (08),
409 handling (09).

## Implementation (3 action points)
1. `models.ts` — add `conversation_revision?: number` to the chat request type and
   `revision?: number` to `ConversationSummary` / `ConversationDetail` (mirror
   step 04). Keep optional for backward compatibility.
2. Storage schema — add a `revision?: number` field to the stored chat record
   (the IndexedDB chat object) and persist it when creating/updating a chat.
   Bump the IndexedDB schema version only if the store requires it for the new
   field; otherwise treat it as an optional property on existing records.
3. Sync hydration — in `UnifiedHistory/unifiedHistoryStorage.ts` `runSync` pulls,
   store `detail.revision` on the local record so a pulled chat starts with the
   server's current revision.

## Acceptance criteria
- Local chat records can hold a `revision`.
- Pulled/synced chats persist the server revision locally.
- No change for chats that have no revision yet (treated as "unknown").

## Notes
"Unknown/absent revision" must mean *don't send a precondition* (so the first
turn of a brand-new chat is never a false conflict) — see step 08.
