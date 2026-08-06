# 015 - Deferred: Concurrency And Conflict Handling

## Status

**Not scheduled.** This file exists so the lessons from the closed PRs aren't
lost, not to describe active work. Do not pick this up until Stage 2
(002-012/013) has been live in production and an actual conflict has been
observed, or Stage 3 (014) is making the backend authoritative (which is when
these races start to have real user-visible consequences).

## Why this was deferred rather than built into Stage 2

Stage 2 is a shadow-write path beside the existing IndexedDB-primary flow. A
race between two concurrent writers for the same conversation can, at worst,
leave the *shadow copy* briefly inconsistent — it cannot lose or corrupt what
the user actually sees, because the user isn't reading from the backend yet.
Building locking or conflict detection against a copy nobody depends on yet is
exactly the kind of complexity this backlog is trying to avoid: real code, real
failure modes, no payoff until Stage 3.

## What was already learned (from the closed #1070 / #1071 PRs)

Two real bugs were found and fixed once already; don't rediscover them badly:

- **Cross-device delete resurrection** (#1070, tracked in it-at-m/mucgpt#1069):
  a hard `DELETE` on one device, combined with another device's sync pushing
  its still-cached local copy back up, resurrects a conversation the user
  thought was gone. The fix was a soft-delete tombstone: `deleted_at` on
  `Conversation`, reads exclude tombstoned rows, and re-creating a tombstoned
  id is rejected (409) on both the CRUD create path and the chat-completion
  auto-create path, plus a `GET /v1/conversations/deleted?since=` feed so
  clients learn about remote deletions instead of re-pushing them.
- **Cross-device/cross-tab last-write-wins data loss** (#1071): every chat turn
  replaces the stored conversation with the client's full snapshot before
  appending the assistant turn; two clients on the same conversation can
  silently erase each other's turns. The fix was a server-owned monotonic
  `revision` on `Conversation`: the client sends the revision its history is
  based on, a stale write gets HTTP 409 (not silently overwritten), and
  `revision` only advances on a successfully persisted append so a failed or
  retried turn never causes a spurious self-conflict.

Both are solid designs — opt-in, backward-compatible, tested. When this is
picked back up, start from that shape rather than the pessimistic
per-conversation execution lock considered in an earlier draft of this
backlog: the revision/tombstone approach only activates on an actual conflict,
adds one column each, and needs no cross-worker lock infrastructure.

## When to pick this up

- After Stage 2 has real production traffic and either a resurrection or a
  lost-write incident is actually reported, or
- As a prerequisite for Stage 3, since that's when the backend's copy is what
  users actually rely on and these races stop being merely cosmetic.

Scope it as two small, separable PRs (tombstones; optimistic-concurrency
revision) rather than one combined change, consistent with the rest of this
backlog's philosophy.
