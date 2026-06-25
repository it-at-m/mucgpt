# 08 — Send + capture revision in makeApiRequest

**Milestone:** M3 — Frontend  ·  **Depends on:** 05, 06, 07  ·  **Size:** M  ·  **Action points:** 3

## Context
`mucgpt-frontend/src/pages/page_helpers.ts` `makeApiRequest` builds the chat
request and processes the SSE stream. It must send the local revision and capture
the new one returned by the server.

## Scope
**In:** request field + reading the returned revision (stream + non-stream).
**Out:** what to do on 409 (09).

## Implementation (3 action points)
1. Send it: include `conversation_revision: <local revision for conversation_id>`
   in the `ChatRequest` (omit when unknown, e.g. a brand-new chat — see step 07).
2. Capture it (streaming): in the SSE loop, recognize the
   `object === "conversation.revision"` event from step 06 and remember the value;
   for the non-streaming path, read `conversation_revision` off the response body.
3. Persist it: when saving the turn (`storageService.appendMessage` / `create`),
   write the captured revision onto the local chat record so the next turn sends
   the up-to-date precondition.

## Acceptance criteria
- Each turn for a persisted chat sends the last known revision.
- The new revision from the server is stored locally after a successful turn.
- Brand-new chats (no revision yet) send no precondition and are never falsely
  rejected.

## Notes
Because a normal turn advances revision twice server-side (replace + append, see
step 02), always trust the *server-returned* final value rather than incrementing
locally.
