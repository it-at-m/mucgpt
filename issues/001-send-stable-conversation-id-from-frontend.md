# 001 - Send Stable Conversation ID From Frontend

## Goal

Stage 1 of the rollout. Start sending a stable, frontend-generated chat id to
the backend on every normal-chat request — before any backend persistence
exists. This is deliberately the very first PR: it is safe to merge and deploy
alone, changes no visible behavior, and gives every later stage in this backlog
something to key off.

## Implementation

- In the normal chat send path only (assistant chats are out of scope until
  013):
  - use the active local IndexedDB chat id when continuing an existing chat.
  - generate a UUID before the first request of a new chat, and use that same
    id as the local IndexedDB chat id once the chat is created locally (this is
    already close to today's local-id behavior; the only change is that the id
    is generated up front instead of after the first response, so it can be
    sent with the first request too).
  - pass that id as an optional `conversation_id` field on
    `/v1/chat/completions` requests.
- On the backend, add `conversation_id` as an optional field on the chat
  request schema. Accept it and ignore it (log at debug level if useful). Do
  not add any persistence logic in this issue.

## Acceptance Criteria

- Existing chat requests without `conversation_id` are unaffected.
- The backend accepts requests that include `conversation_id` without any
  change in response behavior.
- The same id is used locally and sent to the backend for the lifetime of one
  chat.
- No IndexedDB schema change is required.

## Tests

- Frontend: new chat sends a generated `conversation_id`; continuing a chat
  sends the existing id.
- Backend: schema test proving `conversation_id` is optional and requests
  without it still validate.

## Reviewer Notes

- This is the only issue in the backlog that must be safe to ship with nothing
  else in this folder merged yet.
- Do not add backend persistence, a conversations router, or any storage in
  this commit — that starts in Stage 2 (002 onward).
