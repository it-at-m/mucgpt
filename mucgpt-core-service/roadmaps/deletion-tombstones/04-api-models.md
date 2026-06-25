# 04 — Tombstone-aware API models

**Milestone:** M2 — API surface  ·  **Depends on:** 03  ·  **Size:** S  ·  **Action points:** 3

## Context
`app/api/api_models.py` defines `ConversationSummary`/`ConversationDetail`/
`CreateConversationRequest`. The tombstone feed needs a response model, and the
resurrection rejection needs a documented error shape.

## Scope
**In:** new `DeletedConversation` (feed item) model + 409 conflict body model.
**Out:** wiring endpoints to them (05, 06), repo logic (02–03).

## Implementation (3 action points)
1. Add `class DeletedConversation(BaseModel)` with `id: str` and
   `deleted_at: datetime`. This is the feed item shape (step 06). Keep it minimal —
   clients only need the id to drop the local chat; `deleted_at` supports a cursor.
2. Add a small conflict body, e.g. `class ConversationConflict(BaseModel)` with
   `detail: str` and `conversation_id: str`, used when re-creating a tombstoned id
   is rejected (step 05). Reuse an existing error model if one already fits.
3. Do **not** add `deleted_at` to `ConversationSummary`/`ConversationDetail`:
   tombstoned conversations are never returned by the normal read paths (step 02),
   so the field would always be null there. Keeping it off avoids implying deleted
   chats can appear in the main list.

## Acceptance criteria
- Models import cleanly and serialize the expected JSON (`datetime` → ISO 8601).
- No change to the existing summary/detail contract.

## Notes
If #1068 landed first and added a `revision` field on the summary/detail models,
leave it; tombstones don't touch it. The two features' models are additive and
independent.
