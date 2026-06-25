# 12 — Docs + production migration + tombstone retention

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 01, 06  ·  **Size:** S  ·  **Action points:** 3

## Context
`create_all` adds the `deleted_at` column only on **fresh** DBs, so existing
Postgres deployments need an explicit migration. The new delete semantics, the
feed endpoint, and the long-term growth of tombstone rows all need documenting.

## Scope
**In:** migration SQL/Alembic note, API + behavior docs, retention strategy.
**Out:** code (01–09).

## Implementation (3 action points)
1. Migration: provide the column add for existing DBs —
   `ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMPTZ NULL;`
   If/when core-service adopts Alembic (it currently has none; only
   `mucgpt-assistant-service-migrations/` exists), add this as a revision; otherwise
   document the manual ALTER in the deploy runbook.
2. Docs: in `CHAT_PERSISTENCE.md` / core-service README, document that delete is now
   a **soft delete** (row retained with `deleted_at`), that reads exclude tombstones
   (404), that re-creating a tombstoned id returns 409, and the
   `GET /conversations/deleted?since=` feed + how clients reconcile with it.
3. Retention: document (and optionally implement) a pruning sweep — hard-delete
   conversations whose `deleted_at` is older than a retention window (e.g. 30–90
   days), since by then all clients have reconciled. Note the trade-off: a client
   offline longer than the window won't see the tombstone and could resurrect
   (bounded, acceptable; backend 409 still blocks the push if the row survives, so
   prune the row only after the window). Cross-link issue #1068.

## Acceptance criteria
- A deployer can add the column to an existing Postgres DB from the docs alone.
- Soft-delete semantics, 409-on-resurrect, and the feed are documented in one place.
- A retention/pruning policy (even if "manual for now") is written down.

## Notes
Retention closes the loop opened by soft delete: tombstones accumulate forever
otherwise. Pruning after a generous window keeps the feed and table bounded while
preserving the anti-resurrection guarantee for any realistically-online client.
