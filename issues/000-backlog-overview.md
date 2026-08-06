# Backend Agent State Persistence Backlog

## Baseline

This backlog is for a **new branch created from `origin/main`**. Do not treat the
closed `feat/state-persistancy-in-backend` branch (PR #1067) or its follow-ups
(#1070 tombstones, #1071 optimistic concurrency) as the implementation baseline —
those PRs were closed unmerged because they landed as one large, hard-to-review
change. The *design* they arrived at was sound (request-authoritative SQL
persistence, checkpointer kept off chat-serving graphs); the *delivery shape* was
the problem. This backlog reimplements the same idea as a sequence of small,
independently mergeable PRs.

## Guiding Principle

**Simplicity first.** Every issue below should be the smallest change that is
still safely deployable on its own. When in doubt, cut scope rather than add a
safeguard for an edge case that hasn't been observed yet. Cross-device conflict
handling, locking, soft-delete semantics, and checkpoint-based execution state
are all real concerns — but they are **deferred** (see the bottom of this file)
until the simple version is live in production and proven, or until a concrete
feature (e.g. human-in-the-loop tool confirmation) actually requires them.
Complexity added speculatively is complexity that can silently break things
before it has ever been used for its intended purpose.

## Three-Stage Rollout

**Stage 1 — Frontend sends a stable id (one PR, deployable alone).**
The frontend starts generating a stable id per normal chat and sending it as
`conversation_id` on chat requests. The backend does nothing with it yet beyond
accepting it. No user-visible behavior changes. This can merge to `main` today
without anything else in this backlog.

**Stage 2 — Backend persistence, built beside the existing flow.**
A SQL read model (`conversations` + `messages`) is built up in small, ordered
PRs and wired to shadow the existing chat flow: every chat turn that carries a
`conversation_id` is also durably recorded in SQL. The frontend still treats
IndexedDB as its working store; nothing about what the user sees changes yet.
Each PR in this stage must be safe to merge and deploy on its own, without
depending on a PR later in the sequence being merged first for `main` to stay
healthy. Scope for this stage is **normal chats only** — assistant chats are a
follow-up increment (013) once the normal-chat path has run in production.

**Stage 3 — Cutover to backend-as-source-of-truth.**
Switch the frontend from IndexedDB-primary to backend-primary. This is
intentionally the least specified stage in this backlog (014) — it is the one
place where real user-visible behavior changes, so it needs its own rollout
design (dual-read window, feature flag, fallback) once Stage 2 has been running
in production long enough to trust it. Do not start implementing Stage 3 before
that.

## Target Architecture (Stage 2/3 end state)

- SQL stores the user-visible chat read model: conversations, message list,
  title, favorite state, timestamps, ownership, and (from issue 013) optional
  assistant association.
- The frontend keeps its existing IndexedDB behavior for compatibility and
  mirrors normal chats to the backend (assistant chats: see 013).
- Cross-chat long-term memory is out of scope.
- A LangGraph checkpointer is **not** part of this rollout. See "Deferred" below.

## Reviewer Shape

Each file in this folder is one small, reviewable task, grouped by stage.
Recommended implementation order:

**Stage 1**
1. `001-send-stable-conversation-id-from-frontend.md`

**Stage 2 — normal chats only**
2. `002-add-core-db-settings.md`
3. `003-add-chat-persistence-models.md`
4. `004-add-conversation-repository.md`
5. `005-add-conversation-api-schemas.md`
6. `006-add-conversation-router.md`
7. `007-wire-core-db-startup.md`
8. `008-persist-visible-chat-turns-from-chat-router.md`
9. `009-add-frontend-conversations-client.md`
10. `010-mirror-indexeddb-history-with-backend.md`
11. `011-add-observability-config-and-docs.md`
12. `012-end-to-end-verification-stage-2.md`

**Stage 2b — small follow-up, once Stage 2 is live**
13. `013-extend-persistence-to-assistant-chats.md`

**Stage 3 — design first, do not implement prematurely**
14. `014-cutover-plan-backend-as-source-of-truth.md`

## Non-Goals (this backlog)

- Do not add cross-chat long-term memory.
- Do not replace IndexedDB as the frontend working store before Stage 3.
- Do not persist assistant configurations themselves in the core service; only
  chat threads associated with an assistant id (and only from 013 onward).
- Do not hand-edit production database schema outside the repo's migration
  conventions.
- Do not add per-conversation locking, optimistic-concurrency revisions,
  soft-delete tombstones, or a LangGraph checkpointer in this backlog. See below.

## Deferred (recorded, not scheduled)

These are real concerns, not dismissed ones — they were each discovered the hard
way in the closed PRs. They are deliberately kept out of the active rollout so
Stage 2 stays simple and easy to reason about. Each is written up so the design
lessons aren't lost, and so nobody reinvents them with the wrong shape later:

- `015-deferred-concurrency-and-conflict-handling.md` — locking / optimistic
  concurrency / soft-delete tombstones for cross-device and cross-tab races.
  Revisit once Stage 2 is live in production and an actual conflict has been
  observed (or Stage 3 makes the backend authoritative, which is when these
  races start to matter for real).
- `016-deferred-checkpointer-for-agent-execution-state.md` — a LangGraph
  checkpointer, scoped correctly (per-turn, not per-conversation). Build this
  only when a feature that actually needs it is being implemented — e.g. the
  human-in-the-loop tool confirmation work (issue #1085) — not as
  infrastructure-in-advance.
