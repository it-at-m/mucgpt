# 09 — Frontend 409 conflict handling (pull-and-reconcile)

**Milestone:** M3 — Frontend  ·  **Depends on:** 08  ·  **Size:** M  ·  **Action points:** 3

## Context
This realizes the chosen policy: on a 409 the client does not overwrite; it pulls
the authoritative server history, reconciles its local copy, and tells the user.

## Scope
**In:** detect 409 → reload chat + non-blocking notice + re-enable resend.
**Out:** automatic merge of divergent turns (explicitly deferred — see Notes).

## Implementation (3 action points)
1. Detect: in `makeApiRequest` (and/or the chat API wrapper), treat HTTP 409 from
   `/chat/completions` distinctly from generic errors; parse the conflict body
   (`current_revision`).
2. Reconcile: fetch the latest conversation (`getConversation(id)`), replace the
   local chat's messages + `revision` with the server copy, and dispatch the UI
   update so the user sees the authoritative history (their un-sent prompt is
   preserved in the input box, not lost).
3. Notify: show a non-blocking notice ("This chat was updated on another device —
   reloaded the latest version; please resend your message.") and clear the
   loading state. Do not auto-resend (avoid duplicate turns).

## Acceptance criteria
- A 409 reloads the chat to the server state and does not lose the user's pending
  input.
- The user is informed and can resend; resend now carries the refreshed revision
  and succeeds.
- No duplicate turns are created by the conflict flow.

## Notes
Auto-merging the two divergent branches is a separate UX feature; rejecting +
reloading is the safe minimum that eliminates data loss. Revisit only if users
hit conflicts frequently.
