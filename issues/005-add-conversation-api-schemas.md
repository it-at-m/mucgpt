# 005 - Add Conversation API Schemas

## Goal

Stage 2, step 4. Add API models for conversation CRUD and visible messages.

This commit should only add types. Routes come later.

## Implementation

- Add request/response schemas for:
  - conversation summary.
  - conversation detail with ordered messages.
  - create conversation.
  - update conversation metadata.
  - append visible message.
- The chat completion request already gained an optional `conversation_id`
  field in 001 — no schema change needed here beyond what 001 added.
- Do not add a checkpoint-state response schema in this issue. There is no
  checkpointer in this backlog (see `016-deferred-checkpointer-for-agent-execution-state.md`);
  a `/state` endpoint would have nothing real to report.
- Keep visible messages constrained to the roles already accepted by the chat
  API.

## Acceptance Criteria

- Existing chat requests without `conversation_id` still validate.
- New conversation schemas serialize timestamps and message arrays
  consistently.

## Tests

- Unit tests for schema validation where the project already tests API
  models.
- Regression test that old chat request payloads remain valid.

## Reviewer Notes

- Avoid route implementation in this commit.
- Keep wire shape minimal and explicit.
