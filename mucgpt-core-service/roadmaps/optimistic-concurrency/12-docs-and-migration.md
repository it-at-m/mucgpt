# 12 — Docs + production column migration

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 01, 04  ·  **Size:** S  ·  **Action points:** 3

## Context
`create_all` adds the `revision` column only on **fresh** DBs. Existing Postgres
deployments need an explicit migration, and the new request/response contract +
conflict behavior should be documented.

## Scope
**In:** migration SQL/Alembic note, API docs, rollout notes. **Out:** code (01–09).

## Implementation (3 action points)
1. Migration: provide the column add for existing DBs —
   `ALTER TABLE conversations ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`
   If/when core-service adopts Alembic (it currently has none; only
   `mucgpt-assistant-service-migrations/` exists), add this as the first revision;
   otherwise document the manual ALTER in the deploy runbook.
2. API docs: document `conversation_revision` (request), the `revision` fields on
   conversation read/create, the `409` conflict body, and the streaming
   `conversation.revision` event in the core-service README / OpenAPI notes.
3. Rollout: note the opt-in/back-compat contract (omitting `conversation_revision`
   = today's behavior), so backend can ship before the frontend without breaking
   old clients; record the cross-link to issue #1069 (tombstones) as related.

## Acceptance criteria
- A deployer can apply the column to an existing Postgres DB from the docs alone.
- The API contract and conflict semantics are documented in one discoverable place.
- Rollout ordering (backend-first, frontend-second) is written down.

## Notes
Backend-first is safe precisely because the guard is opt-in: no client sends
`conversation_revision` until step 08 ships, so 409s can't occur prematurely.
