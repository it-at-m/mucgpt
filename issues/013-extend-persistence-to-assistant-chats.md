# 013 - Extend Persistence to Assistant Chats

## Goal

Stage 2b. Once the normal-chat path from Stage 2 (002-012) has run in
production and is trusted, extend the same SQL read model to assistant chats.
This is deliberately split out as its own small PR rather than built into
Stage 2 from the start, so Stage 2 could ship and prove itself with a smaller
surface area first.

## Implementation

- Add a nullable `assistant_id` column to `Conversation` (`null` = normal chat,
  non-null = assistant chat). This is the one schema migration this issue
  needs.
- Frontend: in the assistant chat send path, generate the existing
  `CHAT_<assistant_id>_<uuid>` id shape before the first request (mirrors 001
  for normal chats) and pass it as `conversation_id`, with `assistant_id` sent
  as separate metadata.
- Conversation router: accept and return `assistant_id` on create/read; keep
  ownership scoping by `user_id` exactly as for normal chats.
- Chat router: store `assistant_id` on the conversation when present, same
  shadow-write behavior as 008.
- History mirror (010): extend `syncWithBackend()` to also pull/push assistant
  chats into the existing per-assistant local storage grouping.

## Acceptance Criteria

- Assistant-associated conversations are listed and fetched like normal
  conversations, with `assistant_id` included in responses.
- Normal-chat behavior from Stage 2 is unaffected.
- Assistant chats remain grouped under the correct assistant locally after
  pull.

## Tests

- Assistant chat conversation is created with `assistant_id` set.
- Assistant chat cross-user denial (same rules as normal chats).
- Pull/push of assistant chats through the history mirror.

## Reviewer Notes

- Do not bring locking, checkpointer, or soft-delete into this issue either —
  it inherits the same deferred-complexity stance as the rest of Stage 2.
- This is a good point to pause and confirm Stage 2 is stable before treating
  Stage 3 planning (014) as active work.
