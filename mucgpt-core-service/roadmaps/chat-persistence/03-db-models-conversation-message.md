# 03 — `Conversation` & `Message` ORM models

**Milestone:** M1 — Foundations  ·  **Depends on:** 02  ·  **Size:** M

## Context
Define the persisted shape of a chat. The frontend's current shape lives in
`mucgpt-frontend/src/service/storage.ts` (a chat = `{ id, name, favorite, messages[], config,
_last_edited }`, each message `{ role, content, ... }`). Model the backend tables to cover
that so the frontend can later swap IndexedDB → API with minimal contract changes.

## Scope
**In:** `app/database/models.py` with `Conversation` and `Message`.
**Out:** repositories (05), API models (04).

## Implementation
`app/database/models.py` (import `Base` from `app/database/base.py`):

- **`Conversation`**
  - `id: str` PK — UUID string (also used as the LangGraph `thread_id`, issue 09)
  - `user_id: str` (indexed) — owner; sourced from `AuthenticationResult.user_id`
  - `title: str | None`
  - `favorite: bool = False`
  - `assistant_id: str | None` (matches `ChatCompletionRequest.assistant_id`)
  - `model: str | None`, `config: JSON | None` (creativity/temperature/enabled_tools snapshot)
  - `created_at`, `updated_at` (`DateTime`, server defaults; bump `updated_at` on append)
  - `messages = relationship(..., back_populates="conversation", cascade="all, delete-orphan", order_by="Message.sequence")`
- **`Message`**
  - `id: int` PK autoincrement
  - `conversation_id: str` FK → `conversations.id` `ondelete="CASCADE"` (indexed)
  - `sequence: int` — per-conversation ordering (0,1,2,…)
  - `role: str` — `system | user | assistant`
  - `content: Text`
  - `tool_calls: JSON | None` (preserve the frontend's `tool_calls` chunk shape)
  - `created_at: DateTime`
  - `UniqueConstraint("conversation_id", "sequence")`

Register models so `Base.metadata.create_all` (issue 02 `init_db`) picks them up; call
`init_db()` from `warmup_app()` in `app/init_app.py` when `DB.backend == "sqlite"`.

## Acceptance criteria
- Tables create cleanly on SQLite via `init_db()`.
- Deleting a `Conversation` cascades to its `Message` rows.
- `messages` come back ordered by `sequence`.

## Notes
- Postgres prod: add an Alembic migration (optional stretch issue). For hackathon/SQLite,
  `create_all` is enough — note this explicitly in the PR so it isn't mistaken for prod-ready.
- Keep `content` as `Text` (not `String(n)`) — chat messages are unbounded.
