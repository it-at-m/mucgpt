# 003 - Add Chat Persistence Models

## Goal

Stage 2, step 2. Add SQLAlchemy models for the backend chat read model.

The read model stores what the UI needs to list and reopen chats. Keep the
columns to what the UI actually needs today — it is easy to add a column later,
harder to safely remove one that turned out to be unused.

## Implementation

- Add a core-service database package if it does not exist on `main`.
- Add a shared SQLAlchemy declarative base.
- Add `Conversation` model:
  - `id`: string UUID supplied by the frontend (see 001).
  - `user_id`: authenticated owner id.
  - `title`: nullable display name.
  - `favorite`: boolean.
  - `created_at` and `updated_at`.
  - Do **not** add `assistant_id`, `model`, or a `config` JSON column yet —
    those belong to 013 (assistant chats) and are not needed for the
    normal-chat MVP.
- Add `Message` model:
  - integer primary key.
  - `conversation_id` foreign key with cascade delete.
  - monotonic `sequence`.
  - `role`.
  - `content`.
  - `created_at`.
  - Do **not** add a `tool_calls` JSON column yet — the read model only needs
    to reproduce the visible user/assistant transcript for the history list;
    add it later only if a concrete UI requirement needs to show tool activity
    from history.
- Add a uniqueness constraint on `(conversation_id, sequence)`.
- Configure relationship ordering by `sequence`.

## Acceptance Criteria

- Models import cleanly.
- A conversation owns ordered messages.
- Deleting a conversation deletes its messages (hard delete — see the deferred
  soft-delete note in 015 before adding tombstone logic here; it is
  intentionally not part of this issue).
- Models do not depend on FastAPI, auth, or LangGraph.

## Tests

- Add a small unit-level model test or repository test fixture preparation
  that proves metadata can create the tables.

## Reviewer Notes

- Keep this commit schema-only.
- Do not add router or repository behavior here.
- If reviewing this against the closed PR #1067's model, note the deliberately
  smaller column set — that's intentional simplification, not an oversight.
