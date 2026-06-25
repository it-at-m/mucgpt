# 08 — Checkpointer provider

**Milestone:** M3 — Agent state  ·  **Depends on:** 01  ·  **Size:** S

## Context
LangGraph's `create_agent` (used in `app/agent/react_agent.py:50`) accepts a `checkpointer`.
Today none is passed → graph state is ephemeral. A checkpointer persists the full agent state
(messages, tool steps) keyed by `thread_id`, enabling resume. `langgraph` is already a dep;
`MemorySaver` is built in.

## Scope
**In:** `app/config/checkpointer_provider.py` exposing a singleton checkpointer chosen by
config; init/teardown hooks.
**Out:** wiring it into the agent (issue 09).

## Implementation
1. `app/config/checkpointer_provider.py` — `CheckpointerProvider` (mirror the
   `ModelProvider` / `LangfuseProvider` singleton style):
   - `init(settings)` selects:
     - `MemorySaver()` when `DB.backend == "sqlite"` and no persistent path, **or** in tests
       (default, no extra dep).
     - `AsyncSqliteSaver.from_conn_string(<path>)` when a sqlite checkpoint path is configured.
     - `AsyncPostgresSaver.from_conn_string(<url>)` when `DB.backend == "postgres"`.
   - `get_checkpointer()` returns the instance (or `None` to disable — keeps the agent working
     even if checkpointing is off).
   - Manage async context (`__aenter__`/setup) for the async savers; call `.setup()` once.
2. `app/init_app.py::warmup_app` — `await CheckpointerProvider.init(settings)`.
   `destroy_app` — close it.

## Acceptance criteria
- `CheckpointerProvider.get_checkpointer()` returns a `MemorySaver` by default.
- Switching config to a sqlite saver persists checkpoints to disk across restarts.
- If checkpointer init fails, the service still boots (log + run without checkpointing).

## Notes
`AsyncSqliteSaver`/`AsyncPostgresSaver` live in `langgraph-checkpoint-sqlite` /
`langgraph-checkpoint-postgres` (added in issue 01). `MemorySaver` needs nothing extra — so
the test path has zero new runtime deps.
