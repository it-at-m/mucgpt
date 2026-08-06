# 009 - Add Frontend Conversations Client

## Goal

Stage 2, step 8. Add typed frontend API calls for backend conversations.

This commit should not alter history behavior yet.

## Implementation

- Add conversation API types to the frontend model definitions.
- Add client functions for:
  - list conversations.
  - get conversation detail.
  - create conversation.
  - patch title/favorite.
  - delete conversation.
- Do not send `user_id`; identity is always server-derived.
- Treat delete idempotently for frontend UX: a 404 can be considered already
  deleted.

## Acceptance Criteria

- Client functions compile.
- Existing frontend behavior is unchanged.
- API URLs follow the existing backend proxy convention.

## Tests

- Add focused tests if the frontend already has API-client tests.
- Otherwise verify with the TypeScript build in stage verification (012).

## Reviewer Notes

- This is frontend plumbing only.
