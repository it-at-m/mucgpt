# 07 — Frontend tombstone-feed client + types

**Milestone:** M3 — Frontend  ·  **Depends on:** 06  ·  **Size:** S  ·  **Action points:** 3

## Context
`src/api/conversations-client.ts` wraps the conversation endpoints
(`listConversations`, `getConversation`, `createConversation`,
`deleteConversation`). It needs a client for the new tombstone feed plus a type
for the feed item.

## Scope
**In:** `listDeletedConversations` client fn + `DeletedConversation` TS type +
MSW mock. **Out:** using it in sync (08), tests (11).

## Implementation (3 action points)
1. `src/api/models.ts` — add `export interface DeletedConversation { id: string; deleted_at: string; }`
   mirroring the backend model (ISO-8601 string).
2. `src/api/conversations-client.ts` — add
   `export async function listDeletedConversations(since?: string): Promise<DeletedConversation[]>`
   that GETs `${CONVERSATIONS_BASE}/deleted` with an optional `?since=` query param,
   using the existing `getConfig()` + `handleApiRequest` pattern.
3. MSW: add a handler in `src/mocks/` for `GET /conversations/deleted` so mocked dev
   mode and frontend tests can exercise the deletion-sync path without a backend.

## Acceptance criteria
- `listDeletedConversations()` returns typed feed items in mocked dev mode.
- `npm run lint` (prettier + eslint + tsc) clean on touched files.

## Notes
Keep the `since` param optional and string-typed to match the rest of the client;
the storage layer (step 08) owns the cursor and decides when to pass it.
