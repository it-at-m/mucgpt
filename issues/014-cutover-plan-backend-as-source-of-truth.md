# 014 - Cutover Plan: Backend As Source Of Truth

## Goal

Stage 3. Switch the frontend from IndexedDB-primary to backend-primary for
normal (and, once 013 has run, assistant) chats.

This issue is intentionally **not** a fully specified implementation task like
the others in this backlog. It is the one stage where real user-visible
behavior changes — if the backend read model has drifted from what a user's
IndexedDB actually has (missed sync, a bug in Stage 2's shadow-write), cutting
over the wrong way loses or hides real chat history. That risk needs a rollout
design of its own before writing code, not a checklist bolted onto the pattern
used for Stage 2.

## Do Not Start This Until

- Stage 2 (002-012) has been live in production long enough to trust the
  shadow-write path (no known sync gaps, no unexplained backend/local
  divergence reports).
- 013 has shipped, if assistant chats are in scope for this cutover too.

## Open Questions To Resolve Before Implementation

- **Direction of the switch**: does the backend become the read path
  immediately, or is there a dual-read window (read from backend, fall back to
  IndexedDB on miss/error) before IndexedDB is dropped?
- **Reconciliation on first cutover**: for a user whose IndexedDB and backend
  have both been in use, which one wins if they disagree, and how is that
  decided per-conversation vs. globally?
- **Rollout control**: feature flag, percentage rollout, or all-at-once? What's
  the fallback if backend-primary reads show a regression in production?
- **What "done" means**: is IndexedDB removed entirely, kept as an offline
  cache, or kept as a fallback store indefinitely?

## Non-Goals (for now)

- Do not write implementation code against this issue until the open questions
  above have actual answers.
- Do not fold in checkpointer or locking work here just because it's the
  "final" stage — revisit `015` and `016` on their own merits, triggered by
  their own stated conditions, not because Stage 3 started.

## Reviewer Notes

- Treat this file as a placeholder that should be replaced with a real,
  reviewed rollout plan (and likely split into several smaller issues, in the
  same spirit as the rest of this backlog) once Stage 2 has proven itself.
