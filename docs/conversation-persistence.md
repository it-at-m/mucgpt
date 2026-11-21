# Conversation persistence and deletion

## Request and transcript behavior

Both chat endpoints validate the model before preparing persistence. An unknown
model returns HTTP 400; an uninitialized model registry returns HTTP 500. Neither
case creates an ownership row or initializes an agent.

With `persist=true`, the first request claims a fresh conversation ID for its
authenticated owner and seeds the checkpoint with client history. Once a
checkpoint exists, only the newest user message is appended. With `persist=false`,
the full client history is used without persisted ownership/checkpoint preparation.

The system prompt is request-scoped. The client sends the current one with every
request; the agent moves it out of the graph input into `RequestContext.system_prompt`,
so it never reaches the checkpoint. `ContextMiddleware` replaces the leading system
messages with it on every model call. Edited assistant or custom prompts therefore
apply to existing chats from the next turn on, and checkpoints written before this
change, which still carry a frozen prompt, are corrected without a data migration.
System messages further down the history (inserted by deepagents) are kept. A HITL
resume has no graph input messages, so the router takes the prompt from the resume
request and hands it to the agent separately (not via `configurable`: LangGraph copies
plain configurable values into the checkpoint metadata). Only a request without any
messages leaves the stored messages untouched.

The v1 endpoint supports streaming and non-streaming responses; v2 always streams
AG-UI events, regardless of the request's `stream` flag.

Conversation listing returns only live metadata owned by the caller. Transcript
reads check live ownership before reading through the fenced saver. Unknown,
foreign, and already retired mappings fail that ownership check with HTTP 403.
An empty transcript, or deletion between authorization and the fenced read,
returns HTTP 404. Display reconstruction preserves tool activity and available
usage metadata; legacy provider context counts are not cumulative turn totals.

## Temporary regenerate/retry availability

Persistence-enabled chats disable regeneration and failure retry because editing
browser history does not rewind a backend checkpoint. A failed run can already
have persisted its question before the browser sets `backendPersisted`.
Availability therefore follows the request's `persist` mode, defaulting to enabled
persistence, rather than the cache flag. Handlers reject replacement actions before
local mutation or API scheduling, and controls explain why the action is unavailable.

Stateless assistant previews retain supported regeneration/retry. Normal follow-up
questions remain enabled as new turns. Local rollback/error editing affects only
browser history. Future replacement support requires explicit backend replace/resume
semantics, stable turn identities, authorization, and coordinated concurrent changes.
Question-text deduplication is unsuitable because repeated questions can be legitimate.

## Browser cache and cleanup

History sync downloads metadata, retaining local-only chats and browser settings,
names, and favorites. Previously synchronized chats absent from the authoritative
server list are removed locally. Concurrent sync callers share one in-flight operation;
a failed sync can be retried.

Transcript loading refreshes from the server. It falls back to a nonempty cache for
HTTP 404, or HTTP 403 only when the record is browser-only. Authorization denial
for known server chats, transient server errors, and network failures propagate.
An assistant transcript-load failure clears the requested `chatId` URL parameter,
ending the loading skeleton and showing the existing failure notification.

`deleteConversationApi` is the canonical DELETE client. Successful responses and
HTTP 404 complete deletion; other HTTP errors and network failures propagate.
Unified history and assistant cleanup await server completion before removing a
local chat. Assistant-prefixed browser keys are reduced to the plain conversation
UUID; configuration records do not call the conversation endpoint.

Assistant cleanup retains configuration until all required chat cleanup succeeds.
On partial failure, completed deletions remain complete and failed/unattempted
records remain retryable. Higher-level assistant deletion/unsubscribe reports
failure rather than complete success when required cleanup fails.

## Browser chat migration (temporary)

Chats that only exist in a browser's IndexedDB are uploaded once, so they are
available on every device. The browser pushes; there is no server-side job,
because only the browser has the data.

**Frontend** (`src/service/chatMigration/`): `syncHistory()` calls
`migrateLocalChatsToBackend()` before listing server conversations. Listing marks
every server chat as `backendPersisted`, so running the migration first ensures a
chat is only marked after its own import succeeded. For each local chat (normal
and assistant chats, assistant configs excluded) without `backendPersisted`:

- Only finished turns are sent: turns with `response.error` or an empty answer are
  dropped. A chat with no turns left (e.g. the placeholder of a failed first turn)
  is not sent and stays local.
- The conversation ID is the local key, minus the `CHAT_<assistantId>_` prefix for
  assistant chats. Keys that are not UUIDs (legacy records) get a fresh UUID and are
  re-keyed locally in the same IndexedDB transaction that marks them.
- Chats are uploaded one at a time. On success the unchanged record is written back
  with `backendPersisted: true`; `_last_edited` is kept so the order stays the same.
- HTTP 403/409/413/422 keep the chat local and continue with the next one. Network
  errors, 5xx and expired logins stop the run; it resumes on the next app start.
- Nothing is deleted locally. The run is idempotent and needs no "done" flag: it is
  finished when no unpersisted chat with turns is left.

The MSW mock answers 409 on purpose: mock mode lists no conversations, so marked
chats would be removed locally by the next history sync.

**Backend** (`app/chat_migration/`): `POST /v1/conversations/import` takes
`conversation_id`, `title`, optional `assistant_id`, optional `last_edited` and the
`turns`. It runs under the same per-conversation run lock as chat turns.

| Case | Result |
| --- | --- |
| New ID | Claimed for the caller, checkpoint written → `imported` |
| Owned, checkpoint exists | Nothing written, server state wins → `skipped` |
| Owned, no checkpoint (e.g. retry after a failed write) | Checkpoint written → `imported` |
| Foreign or retired ID | HTTP 409 |
| Chat turn currently running | HTTP 409 |
| No turns, blank texts, over the limits | HTTP 422 |

The transcript is written as a regular checkpoint through a minimal LangGraph graph
compiled with the shared fenced checkpointer, so readback and later chat turns work
unchanged. It contains only user/assistant messages: no system prompt (applied per
request), no tool traces, usage or documents. Title, `updated_at` and a missing
`assistant_id` are set in one update; `updated_at` takes `last_edited`, capped at
the current time so a client clock running ahead can't pin a chat to the top.
Owned IDs are checked before claiming, so `skipped` chats keep their position.

**Removal:** once the migration window is over, delete `app/chat_migration/`,
`src/service/chatMigration/` and their tests, and the lines marked
`TODO: remove after the browser chat migration` (`backend.py`, `mocks/handlers.ts`,
`conversationHistory.ts`, `conversationHistory.test.ts`). Browser-only fallbacks
such as the local rename in `unifiedHistoryStorage.ts` can go at the same time.
Chats of users who never opened MUCGPT during the window stay browser-only.

## Durable deletion invariant

A deleted conversation ID is permanently retired for both its former owner and
other users. New conversations must use fresh UUIDs. Retirement rows retain the
original conversation ID, owner, timestamps, and `deleted_at`; title and assistant
association are cleared. They are excluded from live ownership, title updates,
and history listing.

`FencedPostgresSaver` holds a live ownership row's PostgreSQL `FOR SHARE` lock for
each checkpoint read, history iteration, checkpoint write, or pending-task write.
The inner saver uses the same connection and transaction as the lock. A missing
or retired row raises `ConversationDeletedError`. This coordination works across
workers and service instances and does not rely on an in-process or run-long lock.
Streaming iterators are explicitly closed, with cancellation-shielded teardown.

DELETE uses `FOR UPDATE` on the ownership row, erases checkpoints, pending writes,
and blobs, then records retirement in the same transaction. An in-flight fenced
operation either finishes before erasure or is refused after retirement. DELETE
returns HTTP 204 only after commit. Owner retries repeat physical cleanup and
return 204; a missing mapping returns 404 and another owner receives 403.
Erasure failures return 500 and roll back all deletions, preserving ownership
protection and a retryable DELETE target. The repository's metadata-only retirement
method is not a substitute for this atomic erasure operation.

## Schema migration and rollout

1. Stop accepting new generation requests and stop/drain **every old writer**
   before starting fence-aware instances. Old binaries do not honor the row fence
   and may delete retirement mappings; mixed-version writing is unsafe.
2. Run the core migration Job. It initializes the checkpoint and chat schemas and
   idempotently adds `chats.deleted_at` to existing tables. `create_all` alone does
   not migrate them.
3. During that one-time migration, checkpoint IDs without ownership mappings are
   quarantined as retired rows with an empty owner, and their checkpoint,
   pending-write, and blob records are erased. Existing mapped histories remain
   associated with their original owners and preserve their checkpoint identities.
4. A failed migration or legacy cleanup prevents the migration Job from completing;
   fix it and rerun the Job before starting core instances. Post-migration runtime
   startup only opens persistence resources and does not repeat legacy cleanup.
5. Start only fence-aware instances after the migration Job succeeds. Do not roll
   back to an unfenced binary after
   migration. Do not purge retirement rows while clients can present the same public
   IDs again: removing them would permit ID reclamation.

## Validation

From `mucgpt-core-service`, run the configured router/repository checks:

```bash
uv run pytest tests/integration/test_chat_router.py
uv run pytest tests/unit/test_conversation_repo.py
uv run pytest tests/unit/test_request_system_prompt.py tests/unit/test_tool_approval.py
uv run pytest tests/unit/test_chat_migration.py tests/integration/test_chat_migration_router.py
uv run ruff check app tests
uv run ruff format --check app tests
```

The opt-in lifecycle suite requires a disposable PostgreSQL server and a user with
`CREATEDB`; it creates/drops uniquely named databases. Without the opt-in host it
skips. Run against the test server, never a production database:

```bash
MUCGPT_LIFECYCLE_POSTGRES_HOST=127.0.0.1 MUCGPT_LIFECYCLE_POSTGRES_PORT=5433 uv run pytest tests/integration/test_conversation_lifecycle_postgres.py
```

Optional credentials use `MUCGPT_LIFECYCLE_POSTGRES_USER` and
`MUCGPT_LIFECYCLE_POSTGRES_PASSWORD`. The suite covers paused checkpoint writers,
independent saver pools, lock waits, erasure rollback/retry, ID reuse, legacy
migration, both endpoints, generation failures, and cancellation/disconnect teardown.
Router mocks and SQL compilation tests alone cannot establish the race invariant.

From `mucgpt-frontend`:

```bash
npm run lint
npm run type-check
npx vitest run src/service/conversationHistory.test.ts src/service/chatMigration src/api/conversations-client.test.ts src/service/assistantstorage.test.ts src/components/UnifiedHistory/unifiedHistoryStorage.test.ts src/pages/assistant/AssistantStrategy.test.ts src/pages/page_helpers.test.ts src/components/Answer/Answer.test.tsx
```

Actual runs, environment blockers, browser scenario evidence, and outstanding PR
review work are recorded in [the PR #1314 action plan](PR_1314_CODERABBIT_ACTION_PLAN.md).
CodeRabbit's docstring assessment measures documentation on the reviewed diff;
it is separate from test coverage and needs a fresh assessment after updated code
is published.
