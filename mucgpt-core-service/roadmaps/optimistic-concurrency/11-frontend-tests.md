# 11 — Frontend tests

**Milestone:** M4 — Tests & docs  ·  **Depends on:** 08, 09  ·  **Size:** M  ·  **Action points:** 3

## Context
Cover the client revision plumbing and the 409 reconcile flow. Match the existing
frontend test setup (Vitest) and mock the chat/conversation API.

## Scope
**In:** unit tests for send/capture + conflict reconcile. **Out:** backend (10).

## Implementation (3 action points)
1. Send/capture: assert `makeApiRequest` includes `conversation_revision` when the
   local chat has one and omits it for a brand-new chat; assert the
   `conversation.revision` SSE event (and non-streaming body) updates the stored
   record.
2. Conflict reconcile: mock a 409 from `/chat/completions`; assert the client
   calls `getConversation`, replaces local messages + revision with the server
   copy, preserves the pending input, and surfaces the notice without auto-resend.
3. Regression: a successful resend after a 409 sends the refreshed revision and
   persists the new one; no duplicate local turns are created.

## Acceptance criteria
- New tests pass; `npm run lint` (prettier + eslint + tsc) clean on touched files.
- No console errors in the conflict path.

## Notes
If frontend coverage for `makeApiRequest` is thin today, scope the test to the
extracted revision/conflict helpers rather than the whole streaming function.
