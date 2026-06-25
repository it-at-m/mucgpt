# 02 — Bump `revision` on every message mutation

**Milestone:** M1 — Backend foundation  ·  **Depends on:** 01  ·  **Size:** S  ·  **Action points:** 3

## Context
The `revision` is only meaningful if the server advances it whenever stored
history changes. The two mutation paths in `ConversationRepository`
(`app/database/conversation_repo.py`) are `replace_messages` and
`append_message`; `create` initializes a conversation.

## Scope
**In:** increment `revision` on content mutations. **Out:** the precondition/
conflict check (03), metadata-only updates (title/favorite should NOT bump).

## Implementation (3 action points)
1. `replace_messages` — after re-inserting messages, set
   `conversation.revision = conversation.revision + 1` alongside the existing
   `updated_at` touch (do it in the same flush so it is atomic with the write).
2. `append_message` — after the successful SAVEPOINT insert, likewise bump
   `conversation.revision`. Keep it inside the same transaction as the append so
   revision and message stay consistent under the retry loop.
3. Return the new revision: have both methods return the post-bump
   `conversation.revision` (e.g. include it on the returned object, already
   refreshed) so callers (step 05/06) can surface it without a re-query.

## Acceptance criteria
- Each successful `replace_messages` / `append_message` increments `revision` by
  exactly 1.
- `update_meta` (title/favorite) does **not** change `revision`.
- A turn that both replaces history and appends an assistant message advances
  `revision` deterministically (document whether that is +1 or +2 — see Notes).

## Notes
A normal turn calls `replace_messages` (sync client history) **then**
`append_message` (assistant turn) → `revision` advances twice. That is fine: the
client just needs the *final* value returned by the request (step 05/06). Decide
and document this so step 08's client expectation matches.
