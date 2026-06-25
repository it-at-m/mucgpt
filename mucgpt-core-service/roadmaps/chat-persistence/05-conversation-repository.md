# 05 — `ConversationRepository`

**Milestone:** M2 — Chat store  ·  **Depends on:** 03  ·  **Size:** M

## Context
The generic `Repository` (issue 02) covers basic CRUD by id. Conversations need owner-scoped
queries, eager-loaded messages, and atomic message append with correct `sequence`.

## Scope
**In:** `app/database/conversation_repo.py` with a `ConversationRepository`.
**Out:** HTTP layer (06).

## Implementation
`ConversationRepository(session: AsyncSession)` methods:

- `create(user_id, title=None, assistant_id=None, model=None, config=None, messages=[]) -> Conversation`
  — insert conversation; if initial messages provided, insert them with sequences `0..n`.
- `list_for_user(user_id) -> list[Conversation]` — summary rows, ordered by `updated_at desc`,
  **without** loading messages (use `selectinload` only in `get`).
- `get_for_user(conversation_id, user_id) -> Conversation | None`
  — eager-load `messages` via `selectinload(Conversation.messages)`; returns `None` if not
  owned by `user_id` (enforce ownership in the query — never trust the path param alone).
- `update_meta(conversation_id, user_id, **fields) -> Conversation | None` — title/favorite.
- `delete(conversation_id, user_id) -> bool` — cascade handles messages.
- `append_message(conversation_id, user_id, role, content, tool_calls=None) -> Message`
  — compute next `sequence` (`SELECT max(sequence)+1`), insert, bump `conversation.updated_at`.
  Wrap in a transaction; rely on the `UniqueConstraint(conversation_id, sequence)` as a
  concurrency backstop.

## Acceptance criteria
- Ownership is enforced in every read/write (a user cannot fetch another user's conversation).
- `append_message` produces gap-free, monotonic sequences.
- Covered by unit tests in issue 12.
