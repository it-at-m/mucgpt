# 008 - Persist Visible Chat Turns From Chat Router

## Goal

Stage 2, step 7. Shadow-write user-visible chat history into SQL from
`/v1/chat/completions`, alongside the existing response flow. This is the
first commit where the chat router actually touches the persistence layer, and
it is deliberately as simple as possible: no locking, no checkpointer, no
conflict handling. It runs *beside* the current behavior — nothing about the
response the user receives changes.

## Implementation

- In `/v1/chat/completions`, when `conversation_id` is present:
  - ensure the SQL conversation exists for the authenticated user (auto-create
    if unknown).
  - synchronize SQL messages to the request's visible user/assistant history
    before execution (`replace_messages`).
  - after the model responds, append the final assistant answer.
- For streaming: accumulate assistant text chunks and append one final
  assistant message once the stream completes. Do not persist a message if the
  stream ended in an error.
- For non-streaming: persist only successful assistant responses.
- Do not acquire any lock. Two racing requests for the same `conversation_id`
  (e.g. two tabs) may produce an inconsistent shadow copy in a rare case — that
  is acceptable for this stage, because the shadow copy is not yet what the
  user sees or relies on. See `015-deferred-concurrency-and-conflict-handling.md`
  for when this gets revisited.
- Do not pass `conversation_id` to the agent executor and do not attach a
  checkpointer. This issue is SQL-only.

## Acceptance Criteria

- SQL read model shows the same visible conversation as the frontend, for the
  common case of one active client per conversation.
- Failed generations do not get persisted as assistant messages.
- Streaming and non-streaming behavior match from a persistence perspective.
- Conversation ownership is enforced.
- Legacy chat requests without `conversation_id` are completely unaffected.

## Tests

- Unknown `conversation_id` auto-creates a conversation.
- Existing conversation syncs request history.
- Successful streaming appends a final assistant message.
- Streaming error does not append error text.
- Non-streaming success appends an assistant message.
- Chat request without `conversation_id` is unaffected (no DB writes).

## Reviewer Notes

- This commit joins the SQL read model to the chat flow, but deliberately does
  not try to make that join safe under concurrency yet — that's out of scope
  until 015 is revisited.
- Keep the frontend on its existing IndexedDB-primary behavior; this backend
  change alone should not be user-visible.
