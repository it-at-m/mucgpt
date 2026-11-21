// One-time upload of browser-only chats to the backend.
// Temporary: delete this folder and its hook in conversationHistory.ts once the migration window is over.
import { v4 as uuid, validate as isUuid } from "uuid";
import { API_BASE } from "../../api/core-client";
import { ApiError, handleApiRequest, postConfig } from "../../api/fetch-utils";
import type { ChatResponse } from "../../api/models";
import { ASSISTANT_STORE, CHAT_STORE } from "../../constants";
import { AssistantStorageService } from "../assistantstorage";
import { StorageService, type DBObject } from "../storage";

// same limit as IMPORT_MAX_TITLE_CHARS in the core service
const MAX_TITLE_CHARS = 200;
const FALLBACK_TITLE = "New Chat";
// the server won't take these, retrying doesn't help, chat stays local
const KEEP_LOCAL_STATUSES = [403, 409, 413, 422];

export interface ImportTurn {
    user: string;
    assistant: string;
}

export interface ImportConversationPayload {
    conversation_id: string;
    title: string;
    assistant_id?: string;
    last_edited?: string;
    turns: ImportTurn[];
}

type LocalChat = DBObject<ChatResponse, unknown>;

export function importConversationApi(payload: ImportConversationPayload): Promise<{ status: "imported" | "skipped" }> {
    return handleApiRequest(() => fetch(API_BASE + "v1/conversations/import", postConfig(payload)), "Failed to import conversation");
}

/** Only finished turns, failed or interrupted answers would pollute the model context later. */
export function toImportTurns(chat: LocalChat): ImportTurn[] {
    return chat.messages
        .filter(m => m.user?.trim() && m.response?.answer?.trim() && !m.response.error)
        .map(m => ({ user: m.user, assistant: m.response.answer }));
}

/** Local key -> ids. Assistant chats are stored as CHAT_<assistantId>_<conversationId>. */
function parseKey(id: string, isAssistantStore: boolean): { assistantId?: string; conversationId: string } | undefined {
    if (!isAssistantStore) return { conversationId: id };
    if (!id.startsWith(AssistantStorageService.CHAT_ID)) return undefined; // assistant configs etc.
    const rest = id.slice(AssistantStorageService.CHAT_ID.length);
    const split = rest.lastIndexOf("_");
    if (split <= 0) return undefined;
    return { assistantId: rest.slice(0, split), conversationId: rest.slice(split + 1) };
}

/** Mark as persisted without touching _last_edited (update() would bump it and mess up the order). */
async function markPersisted(storage: StorageService<ChatResponse, unknown>, chat: LocalChat, newId: string) {
    const db = await storage.connectToDB();
    try {
        // one transaction, so a re-keyed chat never exists twice locally
        const tx = db.transaction(storage.config.objectStore_name, "readwrite");
        const writes: Promise<unknown>[] = [tx.store.put({ ...chat, id: newId, backendPersisted: true })];
        if (chat.id && newId !== chat.id) writes.push(tx.store.delete(chat.id));
        await Promise.all([...writes, tx.done]);
    } finally {
        db.close();
    }
}

let pending: Promise<void> | undefined;

/** Upload every local-only chat once; safe to call on every start. */
export function migrateLocalChatsToBackend(): Promise<void> {
    pending ??= migrate().finally(() => {
        pending = undefined;
    });
    return pending;
}

async function migrate(): Promise<void> {
    const counts = { imported: 0, skipped: 0, keptLocal: 0 };
    for (const config of [CHAT_STORE, ASSISTANT_STORE]) {
        const storage = new StorageService<ChatResponse, unknown>(config);
        const isAssistantStore = config === ASSISTANT_STORE;
        for (const chat of (await storage.getAll()) ?? []) {
            if (!chat.id || chat.backendPersisted) continue;
            const key = parseKey(chat.id, isAssistantStore);
            const turns = toImportTurns(chat);
            // nothing worth migrating (e.g. only failed turns), stays local untouched
            if (!key || turns.length === 0) continue;

            // old chats may have non uuid keys, those get a fresh id
            const conversationId = isUuid(key.conversationId) ? key.conversationId : uuid();
            const newId = key.assistantId ? AssistantStorageService.GENERATE_BOT_CHAT_ID(key.assistantId, conversationId) : conversationId;
            try {
                const { status } = await importConversationApi({
                    conversation_id: conversationId,
                    title: (chat.name?.trim() || FALLBACK_TITLE).slice(0, MAX_TITLE_CHARS),
                    assistant_id: key.assistantId,
                    last_edited: chat._last_edited ? new Date(chat._last_edited).toISOString() : undefined,
                    turns
                });
                counts[status]++;
            } catch (error) {
                if (error instanceof ApiError && KEEP_LOCAL_STATUSES.includes(error.status)) {
                    counts.keptLocal++;
                    continue;
                }
                // network, server or auth trouble, try again on the next start
                console.warn("Chat migration paused, retrying on next start", error);
                return;
            }
            await markPersisted(storage, chat, newId);
        }
    }
    if (counts.imported || counts.skipped || counts.keptLocal) console.info("Chat migration", counts);
}
