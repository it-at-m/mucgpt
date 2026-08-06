# 010 - Mirror IndexedDB History With Backend

## Goal

Stage 2, step 9. Keep the current IndexedDB history behavior while
synchronizing normal chats with the backend. Assistant chats are explicitly out
of scope here — see 013.

## Implementation

- Extend `UnifiedHistoryStorage` with a guarded sync method.
- On sync:
  - pull backend normal conversations missing locally into the normal chat
    store.
  - push local normal chats missing in backend to the backend, preserving
    local ids.
- Convert backend ordered role/content messages into the local user/assistant
  turn shape.
- Convert local user/assistant turns into backend visible messages.
- Mirror normal-chat rename, favorite, and delete operations to the backend
  best-effort.
- Keep local behavior usable if backend sync fails.
- Avoid concurrent duplicate sync runs from repeated history refreshes.

## Acceptance Criteria

- Existing local history UI keeps working offline or when sync fails.
- Chats created in another browser can appear locally after sync.
- Old local normal chats are migrated to backend once.

## Tests

- Pull backend-only chat into local storage.
- Push local-only normal chat to backend.
- Rename/favorite/delete mirror calls are made for normal chats.
- Sync failure allows local history to render.

## Reviewer Notes

- This commit is compatibility-focused.
- Do not make the backend the primary frontend store yet — that is Stage 3.
- Assistant chats are handled in 013, once this normal-chat path has run in
  production; don't fold them in here.
