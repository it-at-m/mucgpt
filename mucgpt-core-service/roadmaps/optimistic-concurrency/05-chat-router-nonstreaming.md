# 05 — Wire precondition + 409 in chat_router (non-streaming)

**Milestone:** M2 — API surface  ·  **Depends on:** 03, 04  ·  **Size:** M  ·  **Action points:** 3

## Context
`app/api/routers/chat_router.py` calls `repo.replace_messages(...)` each turn
(around L132) then appends the assistant turn. It must pass the client's
expected revision, translate `ConflictError` to HTTP 409, and return the final
revision on the non-streaming path.

## Scope
**In:** non-streaming flow + 409 mapping. **Out:** SSE revision (06).

## Implementation (3 action points)
1. Pass the precondition: call
   `repo.replace_messages(conversation_id, user_id, msgs, expected_revision=request.conversation_revision)`.
   Wrap it so a raised `ConflictError` becomes
   `raise HTTPException(status_code=409, detail=ConversationConflict(...))` —
   and crucially do this **before** invoking the model (don't spend a generation
   on a turn that will be rejected).
2. Capture the post-turn revision: after the successful `append_message`, read
   the returned revision (step 02) and set it on the `ChatCompletionResponse`
   (`conversation_revision`).
3. Keep ordering correct: conflict check + history sync happen, `await session.commit()`
   as today; ensure the 409 path does not commit a partial write (it raised
   before any mutation, so nothing to roll back — verify with a test in step 10).

## Acceptance criteria
- Stale `conversation_revision` → 409 with the conflict body, no model call, no DB
  write.
- Successful non-streaming turn returns the new `conversation_revision`.
- Requests without `conversation_revision` behave exactly as before.

## Notes
Reject **before** generation is the cost-saver and the correctness win: it avoids
persisting a turn the client must discard anyway.
