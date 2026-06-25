# Optimistic concurrency guard for cross-device chat turns

Tracks GitHub issue **it-at-m/mucgpt#1068** (follow-up from PR #1067).

## Problem
Every chat turn rewrites the stored conversation to the client's snapshot
(`ConversationRepository.replace_messages`) before appending the assistant turn.
If the same chat is open in two tabs/devices, the later request can erase turns
already persisted by the other client but not yet present in its local history —
silent **last-write-wins data loss**.

(The single-conversation append-sequence race was already fixed in PR #1067 via a
SAVEPOINT + retry on `uq_message_sequence`. This is the higher-level cross-client
overwrite.)

## Chosen approach — reject-and-reload (lightweight)
Add a server-authoritative integer `revision` per conversation:

- The client sends the `revision` its current history is based on
  (`conversation_revision` on the chat request).
- On a write, the server compares stored `revision` vs the client's expectation:
  - **match** → apply, bump `revision`, return the new value.
  - **mismatch** → reject with **HTTP 409** and do **not** overwrite.
- The client handles 409 by pulling the latest server history and reconciling
  (reload the chat, surface a non-blocking notice), then the user can resend.

Merge-on-conflict is explicitly **out of scope** (see Notes); rejecting kills the
data-loss path without committing to merge UX.

## Backward compatibility / rollout
`conversation_revision` is **optional**. When a request omits it, the server skips
the precondition check and behaves exactly as today — so the guard is opt-in per
request and old clients keep working. No flag day.

## Milestones & steps (each step ≈ 3 action points)

**M1 — Backend foundation**
- `01-add-revision-column.md` — `revision` column + schema/backfill strategy
- `02-bump-revision-on-mutations.md` — increment on every message mutation
- `03-conflict-check-in-repository.md` — precondition check + `ConflictError`

**M2 — API surface**
- `04-api-models.md` — request/response/detail revision fields + 409 schema
- `05-chat-router-nonstreaming.md` — wire precondition + map to HTTP 409
- `06-streaming-revision-event.md` — emit new revision on the SSE path

**M3 — Frontend**
- `07-frontend-models-and-storage.md` — TS types + persist revision locally
- `08-send-and-capture-revision.md` — plumb revision through `makeApiRequest`
- `09-conflict-handling.md` — 409 → pull-and-reconcile + user notice

**M4 — Tests & docs**
- `10-backend-tests.md` — repo conflict + router 409 + increment tests
- `11-frontend-tests.md` — revision plumbing + 409 reconcile tests
- `12-docs-and-migration.md` — README/config + prod column migration note

## Notes
- These planning files live under `issues/` which is git-ignored (local scratch),
  matching the `chat-persistence/` set.
- Revision is a monotonic integer owned by the server; never trust a client-set
  value except as the *expected* precondition.
