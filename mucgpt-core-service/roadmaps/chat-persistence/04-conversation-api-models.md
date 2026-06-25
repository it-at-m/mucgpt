# 04 — Conversation/Message API (Pydantic) models

**Milestone:** M2 — Chat store  ·  **Depends on:** 01  ·  **Size:** S

## Context
Routers need request/response schemas separate from ORM models. Existing API models live in
`app/api/api_models.py` (e.g. `ChatCompletionMessage`, `ChatCompletionRequest`). Reuse
`ChatCompletionMessage` for message payloads to stay consistent with `/chat/completions`.

## Scope
**In:** Pydantic models for conversation CRUD.
**Out:** router logic (06).

## Implementation
Add to `app/api/api_models.py` (or a new `app/api/conversation_models.py`):

- `ConversationSummary` — `id, title, favorite, assistant_id, model, created_at, updated_at`
  (list view, no messages).
- `ConversationDetail` — `ConversationSummary` + `messages: list[ChatCompletionMessage]`.
- `CreateConversationRequest` — `title: str | None`, `assistant_id: str | None`,
  `model: str | None`, optional initial `messages: list[ChatCompletionMessage] = []`.
- `UpdateConversationRequest` — `title: str | None`, `favorite: bool | None` (PATCH semantics).
- `AppendMessageRequest` — a single `ChatCompletionMessage`.

Use `model_config = ConfigDict(from_attributes=True)` so responses can be built directly from
ORM rows.

## Acceptance criteria
- Schemas serialize ORM rows (`ConversationDetail.model_validate(orm_conversation)`).
- OpenAPI docs render the new schemas under the Conversations tag (added in 06).
