# 004 - Add Conversation Repository

## Goal

Stage 2, step 3. Add an owner-scoped repository for conversation and message
persistence.

Every method must enforce `user_id` ownership — this is a basic security
requirement, not the kind of complexity this backlog is trying to avoid. A
caller with a valid conversation id but the wrong user must receive `None` or
`False`, not data.

## Implementation

- Add `ConversationRepository`.
- Implement:
  - create conversation with caller-supplied id.
  - seed initial ordered messages.
  - list conversations for one user, most recently updated first.
  - get one conversation for one user.
  - update title/favorite metadata.
  - delete a conversation (hard delete; see 015 for why soft delete is
    deferred rather than built here).
  - replace visible messages with a supplied ordered list.
  - append one visible message at the next sequence.
- Keep repository methods transaction-neutral: flush inside methods, commit in
  callers.
- Do not add retry/collision handling for two concurrent appends racing to the
  same sequence number in this issue. Stage 2 shadow-writes beside the existing
  flow, so a rare sequencing race here does not affect what the user sees; if
  it happens, worst case is a to-be-repaired shadow copy, not data loss. Revisit
  under 015 if this is observed in practice.

## Acceptance Criteria

- User A cannot read, update, append to, or delete User B's conversation.
- Replacing messages preserves order exactly as supplied.
- Appending advances the sequence and updates the conversation timestamp.
- Repository does not know about LangGraph checkpoints.

## Tests

- Create/list/get for one user.
- Cross-user denial for get/update/delete/append.
- Seed messages are ordered.
- Replace removes old messages and inserts the new order.
- Append chooses the next sequence.
- Delete cascades messages.

## Reviewer Notes

- This commit establishes the durable UI read model.
- It should not add API routes yet.
