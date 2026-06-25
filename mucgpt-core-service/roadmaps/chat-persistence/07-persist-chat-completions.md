# 07 — Persist turns in `/chat/completions`

**Milestone:** M2 — Chat store  ·  **Depends on:** 06  ·  **Size:** M

## Context
`app/api/routers/chat_router.py::chat_completions` is currently stateless: it takes the full
`messages` array each call and returns a completion. To store chats server-side we persist the
incoming user turn and the produced assistant turn against a conversation.

## Scope
**In:** optional `conversation_id` on the chat request; persist user + assistant messages.
**Out:** checkpointer/thread wiring (issue 09 — separate concern, can land independently).

## Implementation
1. `app/api/api_models.py` — add `conversation_id: str | None = None` to
   `ChatCompletionRequest`. **Optional** → existing stateless clients unaffected.
2. `chat_router.chat_completions`:
   - Inject `session = Depends(get_db_session)`.
   - If `conversation_id` is set:
     - Validate ownership via `ConversationRepository.get_for_user`; 404 if missing.
     - Persist the **last user message** from `request.messages` before invoking the agent.
   - **Non-streaming:** after `run_without_streaming`, persist the assistant message, commit,
     return as today.
   - **Streaming:** accumulate streamed `content` deltas in the `sse_generator`; on
     `finish_reason in {"stop","error"}`, persist the assembled assistant message and commit.
     (Persist in a `finally`/after-loop block so a disconnect mid-stream still saves what
     arrived.)
   - If `conversation_id` is **not** set, behave exactly as today (no persistence).
3. Optional convenience: if `conversation_id` omitted but client sends
   `persist=true`, auto-create a conversation and return its id in a response header
   (`X-Conversation-Id`). Mark as stretch.

## Acceptance criteria
- With a `conversation_id`, a non-streaming call appends exactly two messages
  (user, assistant) in order.
- A streaming call persists the fully-assembled assistant message once the stream ends.
- Without `conversation_id`, response is byte-for-byte the current behavior.
- Verified offline (fake model) in issue 14.

## Notes
Don't double-store: persist only the newly-arrived user turn, not the entire history the
client replays. Define "last user message" precisely (the final `role=="user"` entry).
