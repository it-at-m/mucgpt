# Deletion tombstones to stop resurrecting cross-device chats

Tracks GitHub issue **it-at-m/mucgpt#1069** (follow-up from PR #1067).

## Problem
Server-side delete is a **hard delete** (`ConversationRepository.delete` →
`session.delete(conversation)`), and the frontend reconcile (`runSync`) **pushes
any local chat that is missing from the backend** as a "migration" of a
pre-existing local chat. The two combine into a resurrection loop:

1. Device A deletes chat *X* → row hard-deleted on the backend, removed from A.
2. Device B still has *X* in IndexedDB. Its next `runSync` sees *X* is not in
   `backendIds` and **re-creates it** on the backend (`createConversation`).
3. Device A's next sync pulls *X* back. The chat the user deleted reappears
   everywhere — **deletes never stick across devices.**

There is also no way for B to *learn* that A deleted *X*; B only ever pulls or
pushes, it never removes.

## Chosen approach — soft-delete tombstones
Replace the hard delete with a server-owned **tombstone** so a deletion is a
durable, queryable fact instead of an absence:

- Add nullable `deleted_at` to `Conversation`. `delete()` sets it (soft delete)
  instead of removing the row.
- `list_for_user` / `get_for_user` **exclude** tombstoned conversations, so
  normal reads behave exactly as today (a deleted chat 404s / is absent).
- `create` with a **tombstoned id does not resurrect** — the server rejects it
  (HTTP 409/410), killing the push-back path at the source.
- A **tombstone feed** lets clients *learn* about deletions: a list of deleted
  ids (optionally `since` a cursor) the client applies locally by removing those
  chats from IndexedDB instead of re-pushing them.

Net effect: a delete on any device propagates; no client can resurrect a chat it
merely still has cached.

## Backward compatibility / rollout
- The tombstone column is additive and inert until `delete()` is switched to soft
  (step 02); old rows simply have `deleted_at = NULL`.
- The tombstone feed is a **new** endpoint; old clients ignore it and keep
  working (they just won't auto-remove remotely-deleted chats — no regression
  versus today, where the same chats currently *resurrect*). Backend can ship
  first; frontend second. No flag day.

## Interaction with #1068 (optimistic concurrency)
Independent but complementary. #1068 guards *content overwrites* via a `revision`
precondition; #1069 guards *existence* via tombstones. They touch the same
`Conversation` model and the same `runSync`, so whichever lands first, the second
rebases its model/migration step on top. Tombstoned conversations are exempt from
revision checks (a delete is terminal).

## Milestones & steps (each step ≈ 3 action points)

**M1 — Backend foundation**
- `01-add-deleted-at-column.md` — `deleted_at` tombstone column + schema note
- `02-soft-delete-in-repository.md` — `delete()` sets tombstone; reads exclude it
- `03-anti-resurrection-and-tombstone-query.md` — block re-create + list-deleted query

**M2 — API surface**
- `04-api-models.md` — tombstone-aware response/error models
- `05-delete-and-read-endpoints.md` — soft-delete endpoint + 410/404 on reads
- `06-tombstone-feed-endpoint.md` — `GET deleted ids (since cursor)` for sync

**M3 — Frontend**
- `07-frontend-client-and-types.md` — tombstone-feed client + TS types
- `08-apply-remote-deletions-in-sync.md` — drop tombstoned chats; never push them
- `09-local-delete-and-race-hardening.md` — local delete stays deleted (no re-pull)

**M4 — Tests & docs**
- `10-backend-tests.md` — soft-delete, no-resurrect, tombstone-feed tests
- `11-frontend-tests.md` — deletion-sync / anti-resurrection tests
- `12-docs-migration-and-retention.md` — column migration + tombstone pruning/retention

## Notes
- These planning files live under `issues/` which is git-ignored (local scratch),
  matching the `chat-persistence/` and `optimistic-concurrency/` sets.
- `deleted_at` (timestamp, not a bare boolean) doubles as the input to a retention
  sweep (step 12): tombstones can be hard-pruned after N days once all clients have
  reconciled.
