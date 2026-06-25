# 06 — Conversations CRUD router

**Milestone:** M2 — Chat store  ·  **Depends on:** 04, 05  ·  **Size:** M

## Context
Expose the chat store over HTTP, mirroring router conventions in
`app/api/routers/chat_router.py` (APIRouter with `/v1` prefix, `Depends(authenticate_user)`).

## Scope
**In:** `app/api/routers/conversations_router.py` + mount in `app/backend.py`.
**Out:** persisting `/chat/completions` turns (07).

## Implementation
1. `app/api/routers/conversations_router.py` — `APIRouter(prefix="/v1/conversations")`,
   each endpoint depending on `authenticate_user` and `get_db_session`:
   - `POST   /`            → create (body `CreateConversationRequest`) → `ConversationDetail`
   - `GET    /`            → list owner's conversations → `list[ConversationSummary]`
   - `GET    /{id}`        → `ConversationDetail` (404 if not owned)
   - `PATCH  /{id}`        → update title/favorite → `ConversationSummary`
   - `DELETE /{id}`        → 204
   - `POST   /{id}/messages` → append one message → `ConversationDetail`
   - Build a `ConversationRepository(session)` per request; pass `user_info.user_id`.
   - **Commit** the session at the end of write handlers (the repo only `flush`es — match
     assistant-service transaction style; commit in the router/dependency).
2. `app/backend.py` — `api_app.include_router(conversations_router.router, tags=["Conversations"])`
   and add a `"Conversations"` entry to `openapi_tags`.

## Acceptance criteria
- Full CRUD works against SQLite; 404 on cross-user access; 204 on delete.
- Endpoints visible in `/api/openapi.json` under the Conversations tag.
- Covered by integration tests in issue 13.

## Notes
Decide commit boundary explicitly: simplest is to `await session.commit()` in each write
handler after the repo call. Document it so issue 07 follows the same pattern.
