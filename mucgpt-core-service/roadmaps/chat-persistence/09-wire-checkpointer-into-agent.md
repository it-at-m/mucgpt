# 09 — Wire checkpointer + `thread_id` into the agent

**Milestone:** M3 — Agent state  ·  **Depends on:** 08  ·  **Size:** M

## Context
`_ConfiguredLangChainAgentGraph` builds agents with `create_agent(...)` in
`app/agent/react_agent.py` (lines 50 and 151/208 for the per-request rebuild). To persist
graph state we pass the checkpointer at construction and a `thread_id` at run time. The
`thread_id` is the `conversation_id` (issue 03/07), unifying layers A and B.

## Scope
**In:** pass checkpointer to all `create_agent` calls; thread `conversation_id` →
`configurable.thread_id` through executor → agent.
**Out:** the resume/get-state endpoint (issue 10).

## Implementation
1. `app/agent/react_agent.py`:
   - Accept an optional `checkpointer` in `_ConfiguredLangChainAgentGraph.__init__` /
     `MUCGPTReActAgent.__init__`; default to `CheckpointerProvider.get_checkpointer()`.
   - Pass `checkpointer=self.checkpointer` to **every** `create_agent(...)` (the init one and
     the two per-request rebuilds in `astream`/`ainvoke`).
2. `app/agent/agent_executor.py`:
   - Add `conversation_id: str | None` params to `run_with_streaming` /
     `run_without_streaming`.
   - When set, add `"thread_id": conversation_id` into the `configurable` dict of the
     `RunnableConfig` (alongside the existing `llm`, `user_info`, … keys).
   - Note: `run_without_streaming` currently calls `self.agent.model.invoke` directly
     (bypassing the graph) — for checkpointed non-streaming, route through
     `self.agent.graph.ainvoke` instead so state is recorded. Guard behind
     `conversation_id is not None` to preserve current fast-path behavior.
3. `app/api/routers/chat_router.py` — pass `conversation_id=request.conversation_id` into the
   executor calls.
4. `app/init_app.py::init_agent` — pass the provider's checkpointer into `MUCGPTReActAgent`.

## Acceptance criteria
- Two sequential `/chat/completions` calls with the same `conversation_id` show the second run
  starting from persisted graph state (the checkpointer has prior messages for that thread).
- Calls without a `conversation_id` keep the current stateless behavior.
- Verified offline (fake model) in issue 14.

## Notes
LangGraph requires `thread_id` in `configurable` whenever a checkpointer is attached and you
want persistence; without it the agent still runs but won't persist. Make the missing-id case
a clean no-op, not an error.
