# 10 — Resume / get-agent-state endpoint

**Milestone:** M3 — Agent state  ·  **Depends on:** 09  ·  **Size:** S

## Context
With a checkpointer attached (issue 09), LangGraph can return the persisted state for a
`thread_id` and resume an interrupted run. Expose this so the frontend can reload an in-flight
agent conversation, not just stored messages.

## Scope
**In:** read-only state endpoint + (optional) explicit resume.
**Out:** human-in-the-loop interrupt UI (future).

## Implementation
1. `app/api/routers/conversations_router.py` (or chat_router):
   - `GET /v1/conversations/{id}/state` → returns the checkpointed graph state for
     `thread_id == id` via `agent.graph.agent.aget_state(config)` where
     `config = {"configurable": {"thread_id": id}}`. Shape the response to
     `{messages, next, values}` (serialize messages to `ChatCompletionMessage`).
   - 404 if the conversation isn't owned by the user; empty/`null` state if no checkpoint yet.
2. (Optional) `POST /v1/conversations/{id}/resume` — re-invoke the agent with no new input
   (`None`) for that `thread_id` to continue an interrupted run; stream like
   `/chat/completions`.

## Acceptance criteria
- After a run with `conversation_id=X`, `GET .../X/state` returns the persisted messages.
- Cross-user access is 404.
- Verified offline in issue 14 (assert state after a fake-model run).

## Notes
Keep this additive and read-mostly; the resume POST is a stretch goal for the demo.
