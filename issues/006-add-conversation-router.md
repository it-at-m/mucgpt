# 006 - Add Conversation Router

## Goal

Stage 2, step 5. Expose backend conversation CRUD endpoints for the frontend
history list. These endpoints operate on the SQL read model only.

## Implementation

- Add `/v1/conversations` router.
- Add endpoints:
  - `POST /v1/conversations`
  - `GET /v1/conversations`
  - `GET /v1/conversations/{conversation_id}`
  - `PATCH /v1/conversations/{conversation_id}`
  - `DELETE /v1/conversations/{conversation_id}`
  - `POST /v1/conversations/{conversation_id}/messages`
- Use authenticated `user_id` from the existing auth dependency.
- Do not accept `user_id` from the client.
- Do not add a `/state` endpoint — no checkpointer exists in this backlog.

## Acceptance Criteria

- All endpoints are user-scoped.
- Delete returns 204 on success.
- Missing or cross-user conversations return 404.

## Tests

- Router integration tests for create/list/get/update/delete.
- Cross-user access tests.

## Reviewer Notes

- This commit may depend on temporary session wiring from tests.
- Full app startup DB wiring is handled in the next task.
