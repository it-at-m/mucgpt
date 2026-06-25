# Server-Side Chat Persistence

> **TL;DR** — Chat history used to live only in the browser (IndexedDB), so opening
> MUCGPT in another browser, device, or a private tab showed an empty history. This
> change persists conversations **server-side in the core service**, keyed by the
> authenticated user (JWT `user_id`). The frontend still uses IndexedDB as its live
> working store but now reconciles it with the backend on load, so a user's normal
> chats follow their identity everywhere. The design is **request-authoritative**: the
> client owns the conversation, generates its `conversation_id`, and resends the full
> history each turn; the backend just durably mirrors it. The LangGraph checkpointer is
> deliberately **off** for chat. **Defaults need zero new config and zero manual
> migration** — but for real durability across container rebuilds, point `DB` at a
> persistent Postgres.

---

## Why

Previously the unified history list was backed solely by browser IndexedDB. History was
therefore:

- **Not portable** — invisible in a different browser, on another device, or in a
  private/incognito tab.
- **Easy to lose** — clearing site data wiped every conversation.

Persisting conversations in the core service, partitioned by the authenticated user,
makes history durable and portable while keeping the existing send path and the
offline-capable local store intact.

## What "request-authoritative" means

The **frontend is the source of truth** for a conversation:

1. The client generates a UUID up front and sends it as `conversation_id` on every
   `/v1/chat/completions` call, along with the **full message history** for that turn
   (the existing send path — unchanged).
2. The backend **auto-creates** the conversation on first use of an unknown
   `conversation_id` (no separate create call, no 404).
3. Each turn it **resyncs** the durable `messages` table to the request's history
   (`replace_messages` = delete-then-reinsert) and **appends** the assistant turn after
   streaming completes.

Consequences:

- Client-side **rollback / regenerate / edit mirror to the backend for free** — the next
  request simply carries the corrected history. No truncation endpoints needed.
- There is **no client/server divergence** to reconcile and far less code than a
  backend-rebuilt-context model.

## Two distinct mechanisms (don't confuse them)

| Mechanism | Purpose | State in this change |
|---|---|---|
| **Postgres/SQLite `conversations` + `messages`** | The actual cross-browser persistence, keyed by JWT `user_id`. | **This is the feature.** Always active. |
| **LangGraph checkpointer (`thread_id`)** | Stores an agent's internal graph scratch state for a future *resume* feature. | **Intentionally OFF for chat.** Provider exists but is never attached to a chat graph. |

Engaging the checkpointer *while* the client resends full history would **double
messages** via LangGraph's `add_messages` reducer and would require a per-turn
`thread_id`. That is why the chat-serving graphs are compiled with `checkpointer=None`.

---

## Changes by area

### Core service (`mucgpt-core-service`)

**Persistence layer (new)**

- `app/database/models.py` — `Conversation` and `Message` ORM models (ordered messages
  with monotonic `sequence`, cascade delete, per-user ownership).
- `app/database/conversation_repo.py` — `ConversationRepository`: `create`,
  `list_for_user`, `get_for_user`, `append_message`, `replace_messages`, `update_meta`,
  `delete`. Every method is **user-scoped**; cross-user access returns `None`/`False`.
- `app/database/session.py` — async engine/session factory; creates missing tables at
  startup via `Base.metadata.create_all` (no Alembic step required for first run).
- `app/database/base.py`, `app/database/__init__.py`, `app/database/repo.py` — base
  + wiring.

**API**

- `app/api/routers/conversations_router.py` — new router at **`/v1/conversations`**:
  - `POST   /v1/conversations` — create (accepts client-supplied id + initial messages)
  - `GET    /v1/conversations` — list current user's conversations
  - `GET    /v1/conversations/{id}` — fetch one with messages
  - `PATCH  /v1/conversations/{id}` — update title / favorite (PATCH semantics)
  - `DELETE /v1/conversations/{id}` — **soft delete** (sets a `deleted_at`
    tombstone; row + messages retained, see *Deletion tombstones* below)
  - `GET    /v1/conversations/deleted?since=` — tombstone feed: ids the user
    deleted (on any device), for cross-device deletion sync
  - `POST   /v1/conversations/{id}/messages` — append a message
  - `GET    /v1/conversations/{id}/state` — checkpoint state probe (returns
    `has_checkpoint=false` gracefully when no checkpointer is engaged)
- `app/api/routers/chat_router.py` — when `conversation_id` is present: resolve/auto-create
  the conversation, `replace_messages` with the request history, and `append_message` the
  assistant turn after streaming. **Does not** pass `conversation_id` to the agent
  executor (the checkpointer stays off).
- `app/api/api_models.py` — request/response schemas for conversations and the
  `conversation_id` field on the chat request.

**Agent / checkpointer**

- `app/config/checkpointer_provider.py` — config-selectable checkpointer
  (`memory` | `sqlite` | `postgres`). Provided for a future resume feature.
- `app/agent/react_agent.py` — chat-serving graphs are compiled with
  `checkpointer=None`. **Critical detail:** the graph is rebuilt per request inside
  `astream`/`ainvoke` whenever the model is reconfigured or `data_sources` are present
  (i.e. essentially every real request), so *all* `create_agent(...)` calls — base **and**
  rebuilt — pass `checkpointer=None`. The provider's saver is held dormant on `self` only.
- `app/agent/agent_executor.py` — carries a now-dead `conversation_id` parameter and
  `thread_id` plumbing that no chat caller exercises (harmless with a checkpointer-less
  graph; left for a future resume path).

**Config / startup**

- `app/config/settings.py` — optional nested `DB` and `CHECKPOINTER` settings.
- `app/init_app.py`, `app/backend.py` — initialize the DB session and checkpointer
  provider on startup.
- `config.yaml.example` — documents the optional `DB` and `CHECKPOINTER` blocks.

### Frontend (`mucgpt-frontend`)

- `src/api/conversations-client.ts` (new) — `listConversations`, `getConversation`,
  `createConversation`, `patchConversation`, `deleteConversation`. **JWT-scoped — the
  client never sends a `user_id`.**
- `src/components/UnifiedHistory/unifiedHistoryStorage.ts` — `syncWithBackend()`: a
  guarded (once-per-instance, never concurrent) **two-way reconcile** —
  - **pull**: backend conversations missing locally are stored into IndexedDB;
  - **push**: local-only chats are created on the backend, **preserving their id** (a
    one-time migration of pre-existing local chats).
  - Rename / delete / favorite changes mirror to the backend best-effort.
- `src/api/models.ts`, `src/api/core-client.ts`, `src/api/index.ts`,
  `src/pages/page_helpers.ts` — types + wiring for the `conversation_id` send path and
  the new client.

### Tests

- `tests/unit/test_conversation_repo.py` — repository: create/list/get/append/replace/
  delete, **user isolation**, cross-user denial, monotonic sequencing, cascade delete.
- `tests/integration/test_conversations_router.py` — router behavior.
- `tests/integration/test_chat_persistence_e2e.py` — end-to-end: history syncs and
  accumulates in the DB, an unknown `conversation_id` is auto-created, the chat flow
  does **not** engage the checkpointer, and a send to a **tombstoned**
  `conversation_id` is rejected with 409 (the second resurrection vector) without
  resurrecting the chat.
- `tests/unit/test_agent_executor.py::TestChatGraphNeverCarriesCheckpointer` —
  regression guard: forces the per-request graph rebuild and asserts **no** chat graph is
  ever compiled with a checkpointer (prevents the `thread_id` error from recurring).
- `tests/unit/test_conversation_repo.py` — also covers tombstones: soft delete
  retains the row/messages, idempotent delete, anti-resurrection guard, writes to
  a tombstoned id fail closed, and `list_deleted_for_user` `since`-cursor.
- `tests/integration/test_conversations_router.py` — also covers soft-delete →
  404, `409` on re-creating a tombstoned id (writes nothing), and the
  owner-scoped tombstone feed with `since`.
- **Suite status: 100 passed, 5 skipped.**

---

## Configuration

**No new config is required to run** — `DB` defaults to a local SQLite file and the
checkpointer to in-memory.

```yaml
# config.yaml — both blocks are OPTIONAL

# Chat persistence database
DB:
  backend: "sqlite"                 # "sqlite" (default) or "postgres"
  sqlite_path: "./data/mucgpt_chat.db"
  # PostgreSQL (required when backend == "postgres"):
  # HOST: "localhost"
  # PORT: 5432
  # NAME: "mucgpt"
  # USER: "mucgpt"
  # PASSWORD: "<your-password>"
  # SCHEMA: null

# LangGraph agent-state checkpointer (reserved for a future resume feature; OFF for chat)
CHECKPOINTER:
  backend: "memory"                 # "memory" (default) | "sqlite" | "postgres"
  sqlite_path: "./data/mucgpt_checkpoints.db"
```

Every key is overridable via environment variables using the `MUCGPT_CORE_` prefix and
`__` as the nesting delimiter, e.g.:

```bash
MUCGPT_CORE_DB__BACKEND=postgres
MUCGPT_CORE_DB__HOST=postgres
MUCGPT_CORE_DB__NAME=mucgpt
```

---

## Rollout notes & known edges

- **Durability across rebuilds:** a SQLite file *inside a container without a mounted
  volume is wiped on rebuild*. For real cross-browser durability in production set
  `DB.backend: postgres` and point it at a **persistent** Postgres.
- **Schema creation** is automatic at startup (`create_all` creates missing tables only;
  no destructive migration). For managed schemas, apply the equivalent DDL ahead of
  deploy.
- **Identity-keyed:** history is partitioned by JWT `user_id`; a different login sees a
  different history *by design*.
- **Scope (phase 1):** only **normal chats** sync. **Assistant chats remain local-only**
  (phase 2).
- **Lossy cross-browser edges:** creativity/system settings are not restored from the
  backend, and the very last assistant turn is delta-text until the next turn overwrites
  it. Conversation *content* is fully persisted.
- **Rollback:** reverting the frontend leaves the new tables unused but harmless; there is
  no destructive migration.

## Deletion tombstones (cross-device delete)

Hard delete + the "push any local chat the backend is missing" reconcile used to
combine into a **resurrection loop**: device A deletes chat *X*, device B still
has *X* locally, B's next sync re-creates *X* on the backend, and A pulls it back
— so deletes never stuck across devices. Deletion is now a **soft delete**:

- `Conversation` carries a nullable `deleted_at`. `DELETE` stamps it instead of
  removing the row (`NULL` = live, a timestamp = tombstoned). `delete()` is
  idempotent and keeps the first timestamp.
- All normal reads (`GET /{id}`, `GET /` list) **exclude tombstones**, so a
  deleted chat returns **404** / is absent — 404 covers both "never existed" and
  "deleted" (a deleted chat is just gone, not a distinct state).
- **Re-creating a tombstoned id is rejected with `409 Conflict`** (body:
  `{detail, conversation_id}`) — both on `POST /v1/conversations` and on the chat
  completion auto-create path. The guard writes nothing, killing the resurrection
  push at the source.
- `GET /v1/conversations/deleted?since=<iso8601>` returns the caller's
  tombstones (`{id, deleted_at}`, oldest-deleted first, owner-scoped). The
  frontend `runSync` fetches it, **removes** those chats from IndexedDB, and
  **excludes** them from the push set — so a delete on one device propagates and
  no client can resurrect a chat it merely still caches. Clients may remember the
  max applied `deleted_at` and pass it back as `since` for incremental sync.

**Degraded path (accepted):** if the backend delete-mirror fails, the chat is
already gone locally but its backend row is still live, so a later sync re-pulls
it and the user can re-delete — a bounded reappearance, never silent data loss.

### Production migration (existing DBs)

`Base.metadata.create_all` only creates *missing tables*; it will **not** add
`deleted_at` to an existing `conversations` table. Fresh DBs (and the default
local SQLite) get the column automatically. For an existing Postgres deployment,
apply once before deploying the new code:

```sql
ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMPTZ NULL;
```

(SQLite: `ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMP NULL;`.)
core-service has no Alembic yet; when it adopts one, add this as a revision.

### Retention / pruning

Tombstones accumulate forever otherwise. A retention sweep can hard-delete
conversations (and their messages) whose `deleted_at` is older than a generous
window (e.g. 30–90 days), by which point all realistically-online clients have
reconciled. Trade-off: a client offline **longer** than the window won't see the
tombstone and could re-push the chat — so prune the **row** only after the window
(while the row survives, the `409` guard still blocks the push). Pruning is
**manual for now** (no scheduled job); the timestamp column is what makes it
possible later. Related: optimistic-concurrency (`#1068`) guards content
overwrites and is independent of these existence tombstones.

## How it was verified

- Automated: repository, router, and end-to-end persistence suites plus the
  checkpointer regression guard, plus the deletion-tombstone repo/router/feed
  tests (100 passed, 5 skipped).
- Manual: a chat created in one browser appears in the history of a second browser /
  private tab for the same logged-in user after rebuild.
