# 012 - End-to-End Verification (Stage 2)

## Goal

Add final coverage proving Stage 2 (normal-chat SQL shadow persistence) works
as a complete system, without reaching into Stage 3 or the deferred items.

## Implementation

- Add backend integration tests for a full shadow-persisted chat lifecycle for
  normal chats:
  - first turn.
  - second turn.
  - load conversation.
  - delete.
- Add frontend-focused tests or TypeScript-level verification for:
  - conversation client.
  - history sync.
  - stable conversation id send path (from 001).
- Add regression tests for legacy behavior: chat without `conversation_id`
  still works exactly as before.
- Run the relevant core and frontend test suites.

## Acceptance Criteria

- A normal chat's messages are durably recorded in SQL and visible via
  `/v1/conversations/{id}`.
- A normal chat still works, and works identically from the user's
  perspective, whether or not backend sync succeeds.
- Cross-user access remains blocked.
- Stateless legacy chat (no `conversation_id`) still works.
- No test in this issue exercises a checkpointer, a lock, or soft-delete —
  those are out of scope for Stage 2 (see 015, 016).

## Suggested Commands

Run commands from the repo root unless project docs specify otherwise:

```bash
uv run pytest mucgpt-core-service/tests
```

```bash
cd mucgpt-frontend
npm run build
```

## Reviewer Notes

- This commit should mostly add tests and small fixes found by those tests.
- Avoid mixing new feature scope into final verification.
- Passing this issue is the signal that 013 (assistant chats) and eventually
  014 (Stage 3 cutover) can be picked up.
