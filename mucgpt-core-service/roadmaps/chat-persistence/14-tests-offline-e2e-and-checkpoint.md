# 14 — Offline end-to-end + checkpoint resume test

**Milestone:** M4 — Offline test proof  ·  **Depends on:** 07, 09, 11  ·  **Size:** M

## Context
The headline proof: with the **model endpoint down**, drive the full chat flow through a fake
model and assert that both the app-level store (A) and the LangGraph checkpointer (B) persist
and reload correctly. This is the acceptance test for the whole epic.

## Scope
**In:** end-to-end tests over `/chat/completions` with persistence + checkpoint assertions.
**Out:** load/perf testing.

## Implementation
Use `test_client_with_fake_model` (issue 11) + sqlite `get_db_session` override (issue 13).

1. `tests/integration/test_chat_persistence_e2e.py`:
   - **Non-streaming persistence:** create a conversation; `POST /v1/chat/completions` with
     `conversation_id`, `stream=false`, a user message; assert response; then
     `GET /v1/conversations/{id}` shows `[user, assistant]` in order.
   - **Streaming persistence:** same with `stream=true`; consume the SSE; assert the assembled
     assistant message was persisted exactly once after `finish_reason=="stop"`.
   - **Backward compat:** `POST` without `conversation_id` returns the normal response and
     creates **no** rows.
2. **Checkpoint resume (B):**
   - With `conversation_id=X`, run one turn; then `GET /v1/conversations/{X}/state` (issue 10)
     returns persisted graph messages.
   - Run a second turn with the same id; assert the agent saw prior state (e.g. via the fake
     model receiving accumulated messages, or state message count increasing).
3. Assert **no outbound network**: the fake model is the only LLM; a real call would fail —
   test passing proves offline operability.

## Acceptance criteria
- All e2e tests pass with no model endpoint / no network.
- Demonstrates: store-and-reload (A), checkpoint persistence + resume (B), and unchanged
  stateless behavior when `conversation_id` is absent.

## Notes
This file is the demo script for "it works with the model down" — keep assertions readable so
it doubles as documentation.
