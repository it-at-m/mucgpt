# Virtual filesystem and document library

Status: implemented in `mucgpt-core-service` (Deep Agents 0.7.34 per `uv.lock`).
This page describes the shipped behavior; the code is the source of truth.

## Summary

- The agent gets a Deep Agents `CompositeBackend` per request
  (`core/virtual_file_system_helper.py::create_backend`).
- Chat-local files (Deep Agents scratch files, evicted large tool results,
  summarization archives) use the default `StateBackend`: they live in graph state
  and are persisted by the conversation checkpointer. With `persist=false` they
  only survive the current run.
- A user's uploaded documents are mounted read-only at `/documents/` through
  `core/document_backend.py::DocumentBackend`, a `StoreBackend` subclass on
  `AsyncPostgresStore`.
- Only the extracted text is stored, never the original PDF/DOCX binary.
- At most **10 documents per user**, enforced by the database.
- The agent can only read documents attached to the current turn
  (`document_ids` in the chat request), revalidated server-side on every turn.
- The system prompt lists the attached documents with path, length and an initial
  excerpt; the agent reads the rest with `read_file` / `grep`.

## Architecture

```text
Deep Agent + FilesystemMiddleware
    |
    +-- CompositeBackend                       (built per request in init_agent)
          |
          +-- default: StateBackend
          |     scratch files, large tool results, summarization archives
          |         |
          |         +-- graph state -> FencedPostgresSaver (only if persist=true)
          |
          +-- /documents/: DocumentBackend (read-only StoreBackend)
                /<document-uuid>.txt   (only the attached documents)
                    |
                    +-- AsyncPostgresStore  (table "store")
                        namespace: ("user_documents", <authenticated user id>)
```

`CompositeBackend` strips the mount prefix before delegating, so the same document
has three identifiers. All are derived in `virtual_file_system_helper.py`:

| Identifier | Example | Helper |
| --- | --- | --- |
| Model-visible path | `/documents/<uuid>.txt` | `get_document_path` |
| Store key | `/<uuid>.txt` | `get_document_storage_key` |
| Store namespace | `("user_documents", <user id>)` | `get_document_namespace` |

The namespace always comes from the authenticated user, never from the client or
the model. User IDs with characters outside `[A-Za-z0-9-_.@+:~]` (or starting
with `utf8:`) are stored as `utf8:<hex>` so they can't act as glob characters.
Filenames never appear in paths.

## Components

| Component | Responsibility |
| --- | --- |
| `core/virtual_file_system_helper.py` | `FileStoreManager` (store connection pool), namespace/path helpers, `create_backend`, `create_permissions`, `get_documents_for_agent`, `delete_document_body`. |
| `core/document_backend.py` | `DocumentBackend`: read-only agent mount restricted to the attached documents. |
| `core/document_service.py` | `DocumentIngestionService` (upload), `DocumentLibraryService` (list/delete), `DocumentService` (resolve a turn's selection). |
| `database/document_repo.py` | `documents` catalog: slot reservation, status transitions. |
| `database/document_catalog.py` | `DocumentCatalogManager`: SQLAlchemy sessions for the catalog. |
| `database/document_lock.py` | Per-document PostgreSQL advisory lock for upload/delete. |
| `core/document_context.py` | Renders the `<attached-documents>` block for the system prompt. |
| `agent/middleware.py::ContextMiddleware` | Appends that block to the system message on every model call. |
| `api/routers/document_router.py` | `GET/POST /v1/documents`, `DELETE /v1/documents/{id}`. |
| `migrations/versions/0002_documents_and_store.py` | Creates `documents` and the LangGraph `store` tables (Alembic, not `store.setup()`). |

`FileStoreManager`, `DocumentCatalogManager` and `PersistanceHelpers` are
initialized independently in `init_app.py::warmup_app`.

## Document library

### Catalog and quota

Each `documents` row has `id`, `user_id`, `slot`, `filename`, `mime_type`,
`original_size`, `text_length`, `preview`, `preview_kind`, `storage_key`, `status`
and `created_at`.

- The quota is a unique `(user_id, slot)` index with `0 <= slot < 10`.
  `reserve_document` tries the slots in order; there is no count-then-insert, so
  concurrent uploads on several instances can't exceed the limit.
- `status` is `processing` → `ready` → `deleting`. Rows in every status occupy a
  slot. A slot is freed only after the body has been deleted from the store.
- Only `ready` rows can be attached to chats.

### Upload (`POST /v1/documents`)

`DocumentIngestionService.ingest_document`:

1. Validate the filename (≤ 255 chars) and the upload size (bounded reads up to
   `documents.max_upload_bytes`). The browser MIME type is kept for display only;
   the parser decides whether the format is supported.
2. Take the advisory lock for a new server-generated UUID.
3. Reserve a slot (`processing`).
4. Parse with the configured parser (Xberg). Reject empty text, NUL characters, and
   text above `documents.max_text_bytes`.
5. Store the text verbatim at `/<uuid>.txt` and keep the first
   `documents.preview_max_chars` characters as the excerpt.
6. Mark the row `ready` and return its metadata.

On any failure or cancellation the row is marked `deleting`, the body is deleted if
a write was attempted, and then the row is removed.

Status codes: 400 invalid upload or parser rejection, 409 limit reached,
413 too large, 415 unsupported format, 422 no usable or invalid text,
502/504 parser errors, 503 no parser configured.

### List and delete

- `GET /v1/documents` returns metadata and excerpts from the catalog only; it never
  reads document bodies. Rows in `processing` and `deleting` are included because
  they use a slot.
- `DELETE /v1/documents/{id}` checks ownership, takes the advisory lock (409 if
  busy), marks the row `deleting`, deletes the exact store key (idempotent), then
  removes the row. It isn't interrupted if the client disconnects. A failed
  cleanup leaves the row in `deleting`, so the delete can be retried.

### Limits (`config.yaml` → `documents:`)

| Setting | Default |
| --- | --- |
| `max_upload_bytes` | 104857600 (100 MiB) |
| `max_text_bytes` | 5242880 (5 MiB) |
| `preview_max_chars` | 1000 |

The 10-document limit is fixed (`DOCUMENT_LIMIT` and a database check constraint).

## Documents in a chat

1. The chat request carries `document_ids`.
   `get_documents_for_agent` → `DocumentService.resolve_selected_documents`
   canonicalizes and deduplicates the IDs and loads only the caller's `ready` rows.
   More than 10 IDs or invalid UUIDs → 400; any missing, foreign or not-ready
   document → 404. This happens before any conversation persistence.
2. `init_agent` builds `create_backend(user_id, selected_ids)` and
   `create_permissions(selected_ids)`:
   - Filesystem permissions allow `read` on `/documents`, `/documents/` and the
     selected paths, and deny read/write on everything else under `/documents/`.
     With no selection the whole mount is denied.
   - `DocumentBackend` enforces the same rule itself: `read_file` only works on
     attached keys, `grep` only searches attached keys, `ls` and `glob` on the
     mount are disabled, and every write, edit, delete, upload or download returns
     "permission denied".
3. `ContextMiddleware` adds the `document_instructions` prompt (from the
   PromptPool, with a built-in fallback) and an `<attached-documents>` block with
   filename, path, text length and initial excerpt to the system message on each
   model call. This block isn't written to checkpoint state, so changing the
   selection on the next turn takes effect immediately.
4. For persisted chats the selection (`document_ids` and filenames) is saved on
   the `chats` row so the UI can restore it when the chat is reopened. An empty
   list clears it; omitting the field leaves it unchanged.

## Frontend

- `src/api/documents-client.ts` calls `/api/backend/v1/documents`.
- `pages/documents/Documents.tsx` is the library page (upload, list, delete).
- `components/ChatDocuments/*` provides the attach menu and the chips in the chat
  input, and sends `document_ids` with each turn.
- `service/parsedDocumentStorage.ts` is legacy: documents previously parsed into
  browser local storage are only shown on the library page, where they can be moved
  to the server library (uploaded as `.txt`) or deleted. Nothing new is written
  there.

The older inline `data_sources` request field is still accepted by the backend
(injected as a guarded message by `ContextMiddleware`), but the current UI no
longer sends it.

## Search behavior and limits

`ls`, `grep` and `read_file` are Deep Agents Python tools, not shell commands. For
`/documents/`, `grep` loads each attached document from the store and matches in
Python. It isn't PostgreSQL full-text search. This saves model context, not
database reads or memory. With at most 10 size-bounded documents per user this is
acceptable. Measure before raising the limits.

Not implemented yet: document summaries, and retrieval for long documents (such as
reading N lines around a key phrase).

## References

- [Deep Agents backends](https://docs.langchain.com/oss/python/deepagents/backends)
- [Filesystem permissions](https://docs.langchain.com/oss/python/deepagents/permissions)
- [Filesystem tools and customization](https://docs.langchain.com/oss/python/deepagents/customization)
- [PostgreSQL store and checkpointer](https://docs.langchain.com/oss/python/langgraph/add-memory#use-in-production)
