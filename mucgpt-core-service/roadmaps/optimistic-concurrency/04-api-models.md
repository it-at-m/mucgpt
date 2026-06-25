# 04 — API models: request/response/detail revision fields

**Milestone:** M2 — API surface  ·  **Depends on:** 03  ·  **Size:** S  ·  **Action points:** 3

## Context
The client needs to send the revision it is based on and read back the new one.
Touch `app/api/api_models.py` (`ChatCompletionRequest` at L70, conversation
models around L482) and the response shapes.

## Scope
**In:** Pydantic field additions + a documented 409 body. **Out:** router logic
(05/06), frontend TS mirror (07).

## Implementation (3 action points)
1. `ChatCompletionRequest` — add
   `conversation_revision: int | None = Field(None, description="Revision the client's history is based on; enables optimistic-concurrency rejection (409) on stale overwrite.")`
   next to `conversation_id`.
2. Expose the current revision on reads/writes: add `revision: int` to
   `ConversationSummary` / `ConversationDetail` (list + get) and to the create
   response, so a freshly pulled or created chat carries its revision.
3. Define the conflict payload: a small `ConversationConflict` model
   (`detail`, `current_revision`, `expected_revision`) and document it as the 409
   response in the `/chat/completions` route `responses={409: ...}`.

## Acceptance criteria
- OpenAPI shows `conversation_revision` on the request and `revision` on
  conversation read/create models.
- 409 response schema is documented on the chat-completions route.
- Existing clients that omit the field still validate.

## Notes
Decide how the *non-streaming* response returns the new revision: simplest is to
add `conversation_revision: int | None` to `ChatCompletionResponse` (populated
only when a conversation_id was involved). Streaming uses step 06 instead.
