# Epic: Backend chat persistence + agent state (offline-testable)

## Goal

Move chat storage from the browser (frontend IndexedDB, `mucgpt-frontend/src/service/storage.ts`)
into the **core service** backend, and add **agent state persistence** so conversations can be
stored, listed, reloaded, and resumed server-side.

Two complementary layers (both in scope):

- **A — App-level chat store.** New SQLAlchemy tables (`conversations`, `messages`) + CRUD
  endpoints, mirroring the proven DB pattern in `mucgpt-assistant-service`. This is the
  user-facing "my chats live in the backend" feature.
- **B — LangGraph checkpointer.** Wire a checkpointer into `create_agent` keyed by a
  `thread_id` (= conversation id). This is the "agentic" layer: full graph state
  (messages, tool progress, scratchpad) persists and a run can resume mid-flight.

**Hard constraint:** the real model endpoint is currently down. Everything here must be
buildable and **fully testable offline** by substituting a fake `BaseChatModel`. The LLM is
already abstracted behind `ModelProvider` (`app/config/model_provider.py`) and
`ModelOptions.custom_model` (`app/init_app.py:43`), which gives us the injection seam.

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| DB engine (default) | **SQLite via `aiosqlite`** | Zero infra, instant tests. Swappable to Postgres through the same SQLAlchemy async API. |
| DB engine (prod) | **Postgres via `asyncpg`** | Matches `mucgpt-assistant-service` stack; opt-in via config. |
| DB layer pattern | Mirror `mucgpt-assistant-service/app/database/` (`session.py`, generic `Repository`, declarative `Base`) | Battle-tested in-repo; keeps services consistent. |
| Checkpointer (default/tests) | `langgraph.checkpoint.memory.MemorySaver` | Built into `langgraph` already; no new dep for tests. |
| Checkpointer (persistent) | `AsyncSqliteSaver` (dev) / `AsyncPostgresSaver` (prod) | Real cross-request resumption; opt-in. |
| `thread_id` | The `conversation_id` | One agent thread per conversation — unifies layers A and B. |
| Offline model | `langchain_core.language_models.fake_chat_models.GenericFakeChatModel` | Scripted, supports streaming + tool calls; no endpoint needed. |
| Backward compatibility | `conversation_id` is **optional** on `/chat/completions` | Existing stateless frontend keeps working; persistence is additive. |

## Dependency graph / sequencing

```
01 deps+settings ─┬─> 02 session+repo ─┬─> 03 models ─┬─> 05 conv repo ─> 06 CRUD router ─┐
                  │                    │              │                                    ├─> 07 persist chat
                  │                    └─> 04 api models ──────────────────────────────────┘
                  │
                  └─> 08 checkpointer provider ─> 09 wire into agent ─> 10 resume/state endpoint

Testing (parallelizable once seams exist):
  11 fake-model fixture ─> 14 offline e2e + checkpoint test
  02/03 ──────────────> 12 db unit tests
  06 ─────────────────> 13 conversations integration tests
```

## Milestones

- **M1 — Foundations:** issues 01, 02, 03  (DB can be created/queried in tests)
- **M2 — Chat store (A):** issues 04, 05, 06, 07  (chats persisted + CRUD)
- **M3 — Agent state (B):** issues 08, 09, 10  (checkpointed, resumable)
- **M4 — Offline test proof:** issues 11, 12, 13, 14  (whole flow green with model down)

## Definition of done for the epic

- A conversation created via the API survives a process restart (SQLite file / Postgres).
- `/chat/completions` with a `conversation_id` persists both the user turn and the assistant
  turn, and the conversation can be reloaded with full history.
- An interrupted agent run can resume from its checkpoint for the same `conversation_id`.
- `pytest` passes **with no network / no model endpoint**, exercising the full chat flow via a
  fake model.

## Issue index

| # | Title | Milestone | Depends on |
|---|---|---|---|
| 01 | Add DB deps + DB settings config | M1 | — |
| 02 | DB session factory + generic Repository | M1 | 01 |
| 03 | `Conversation` & `Message` models | M1 | 02 |
| 04 | Conversation/Message API (Pydantic) models | M2 | 01 |
| 05 | `ConversationRepository` | M2 | 03 |
| 06 | Conversations CRUD router | M2 | 04, 05 |
| 07 | Persist turns in `/chat/completions` | M2 | 06 |
| 08 | Checkpointer provider | M3 | 01 |
| 09 | Wire checkpointer + `thread_id` into agent | M3 | 08 |
| 10 | Resume / get-agent-state endpoint | M3 | 09 |
| 11 | Fake `BaseChatModel` test fixture | M4 | 01 |
| 12 | DB unit tests (models + repo) | M4 | 02, 03 |
| 13 | Conversations CRUD integration tests | M4 | 06 |
| 14 | Offline end-to-end + checkpoint resume test | M4 | 07, 09, 11 |

> Each issue file is self-contained: context, scope, concrete file paths, implementation
> steps, and acceptance criteria. Keep PRs small — one issue per PR where practical.
