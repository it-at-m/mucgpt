# Virtual filesystem implementation plan

Status: proposed implementation; these documents describe future changes, not
features already shipped. Repository and library behavior reviewed on 2026-10-30.
The repository lockfile resolves Deep Agents 0.7.6; confirm the installed API when
implementing, particularly middleware overrides and filesystem permissions.

## Agreed scope

- Use a `CompositeBackend` with `StateBackend` as its default backend.
- Keep chat-local working files, oversized tool results, and archived conversation
  context in graph state, persisted by the existing PostgreSQL checkpointer.
- Mount a user-scoped `StoreBackend` at `/documents/`, backed by
  `AsyncPostgresStore`, for documents available across the user's chats.
- Retain complete extracted text and metadata, not the original PDF/DOCX binary.
- Allow at most **10 documents per user**, enforced server-side under concurrency.
- Expose only documents selected for the current chat, read-only to the agent.
- Initially inject a bounded initial excerpt and a stable document path into the
  effective system prompt. Generate document summaries in a later release.
- Reuse Deep Agents' filesystem tools and backend implementations.
- Keep `app/core/persistance_helpers.py` unchanged. Own filesystem infrastructure
  in a new `app/core/virtual_file_system_helper.py`.

## Architecture

```text
Deep Agent + FilesystemMiddleware
    |
    +-- CompositeBackend
          |
          +-- Default: StateBackend
          |     /large_tool_results/...
          |     /conversation_history/...
          |     other chat-local working files
          |         |
          |         +-- graph state -> existing PostgreSQL checkpointer
          |
          +-- /documents/: StoreBackend
                /<document-id>.txt
                    |
                    +-- AsyncPostgresStore
                        namespace: ("user_documents", authenticated_user_id)
```

`StateBackend` is thread-scoped, not necessarily short-lived: the checkpointer
persists its files across turns and restarts. With `persist=False`, these files
survive only the current invocation. The global document store remains durable
regardless of whether a particular chat uses checkpoint persistence.

`CompositeBackend` strips a mounted route prefix before delegating. Therefore:

| Identifier | Example |
| --- | --- |
| Model-visible path | `/documents/<uuid>.txt` |
| StoreBackend-relative key | `/<uuid>.txt` |
| Store namespace | `("user_documents", authenticated_user_id)` |

Centralize this mapping so uploads and agent reads address exactly the same key.
Do not place user identity in a model-controlled path or accept a client-supplied
namespace.

## Responsibility boundaries

| Component | Responsibility |
| --- | --- |
| Existing `core/persistance_helpers.py` | Checkpointer, conversation ownership/history/deletion. |
| New `core/virtual_file_system_helper.py` | Store lifecycle, namespace/path conventions, backend and permission construction. |
| New `core/document_service.py` | Upload/parse/excerpt/storage workflow, authorization, quotas, and deletion. |
| New `database/document_repo.py` | Document catalog and transactional quota reservations. |
| New `api/routers/document_router.py` | Document-library HTTP API. |
| Existing `agent/middleware.py` | Request-time document manifest and retrieval instructions. |

The filesystem helper owns infrastructure. The document service owns the
user-facing workflow. Parsing remains in the existing parsing implementation.

## Implementation order

1. [Filesystem infrastructure](01-filesystem-infrastructure.md)
2. [Document library and upload API](02-document-library-api.md)
3. [Chat attachments and agent context](03-agent-chat-integration.md)
4. [Frontend integration](04-frontend-integration.md)
5. [Verification and rollout](05-verification-and-rollout.md)
6. [Later release: long-document retrieval and summaries](06-future-long-document-retrieval.md)

Steps 1-5 deliver the first release. Step 6 records follow-up work explicitly,
including reading **N lines around a key phrase**.

## Existing implementation to replace or extend

- `app/agent/deep_agent.py` already uses `create_deep_agent` and the checkpointer,
  but has not wired the imported filesystem backends into agent construction.
- `app/config/harness_profiles.py` controls filesystem tools and summarization.
- `app/api/routers/parsing_router.py` extracts text but does not persist documents.
- `app/agent/middleware.py` currently injects full `data_sources` text into model
  requests; `DefaultAgentState` also persists these payloads.
- Frontend `src/service/parsedDocumentStorage.ts` currently saves parsed bodies in
  browser local storage and permits up to 50 documents.

## Why no custom SQL filesystem tools are needed

The built-in `ls`, `grep`, and `read_file` are Python tools, not shell commands.
`FilesystemMiddleware` calls `StoreBackend`, which invokes the store API;
`AsyncPostgresStore` supplies the SQL implementation.

The standard backend fetches namespace entries and performs directory/path
filtering and literal text matching in Python. `grep` is not PostgreSQL full-text
search. This reduces model context, but not necessarily database reads or
application memory usage. Ten size-bounded documents are an appropriate initial
scope; measure large-document behavior before expanding it.

Document-catalog SQL is application work; SQL for standard virtual filesystem
operations is supplied by the libraries.

## References

- [Deep Agents backends](https://docs.langchain.com/oss/python/deepagents/backends)
- [Filesystem permissions](https://docs.langchain.com/oss/python/deepagents/permissions)
- [Filesystem tools and customization](https://docs.langchain.com/oss/python/deepagents/customization)
- [PostgreSQL store and checkpointer](https://docs.langchain.com/oss/python/langgraph/add-memory#use-in-production)
- [Deep Agents 0.7.6 StoreBackend source](https://github.com/langchain-ai/deepagents/blob/deepagents%3D%3D0.7.6/libs/deepagents/deepagents/backends/store.py)
