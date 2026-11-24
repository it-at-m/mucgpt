import { http, HttpResponse } from "msw";

// 409 on purpose: mock mode lists no conversations, so marking chats as
// persisted would make the history sync delete them locally
export const chatMigrationHandlers = [http.post("/api/backend/v1/conversations/import", () => new HttpResponse(null, { status: 409 }))];
