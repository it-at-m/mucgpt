# Conversation persistence and deletion

## Request and transcript behavior

Both chat endpoints validate the model before preparing persistence. An unknown
model returns HTTP 400; an uninitialized model registry returns HTTP 500. Neither
case creates an ownership row or initializes an agent.

With `persist=true`, the first request claims a fresh conversation ID for its
authenticated owner and seeds the checkpoint with client history. Once a
checkpoint exists, only the newest user message is appended. With `persist=false`,
the full client history is used without persisted ownership/checkpoint preparation.
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
2. Startup initializes the checkpoint schema and chat table, then idempotently adds
   `chats.deleted_at` to existing tables. `create_all` alone does not migrate them.
3. Checkpoint IDs without ownership mappings are quarantined as retired rows with
   an empty owner. Their checkpoint, pending-write, and blob records are erased in
   the startup transaction. Existing mapped histories remain associated with their
   original owners and preserve their checkpoint identities.
4. Failed migration/legacy cleanup aborts initialization and closes provisional
   resources; a subsequent startup retries before serving persistence requests.
5. Start only fence-aware instances. Do not roll back to an unfenced binary after
   migration. Do not purge retirement rows while clients can present the same public
   IDs again: removing them would permit ID reclamation.

## Validation

From `mucgpt-core-service`, run the configured router/repository checks:

```bash
uv run pytest tests/integration/test_chat_router.py
uv run pytest tests/unit/test_conversation_repo.py
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
npx vitest run src/service/conversationHistory.test.ts src/api/conversations-client.test.ts src/service/assistantstorage.test.ts src/components/UnifiedHistory/unifiedHistoryStorage.test.ts src/pages/assistant/AssistantStrategy.test.ts src/pages/page_helpers.test.ts src/components/Answer/Answer.test.tsx
```

Actual runs, environment blockers, browser scenario evidence, and outstanding PR
review work are recorded in [the PR #1314 action plan](PR_1314_CODERABBIT_ACTION_PLAN.md).
CodeRabbit's docstring assessment measures documentation on the reviewed diff;
it is separate from test coverage and needs a fresh assessment after updated code
is published.
