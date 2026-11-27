// One-time upload of browser-only chats to the backend.
// Temporary: delete this folder and its hook in conversationHistory.ts once the migration window is over.
import { v4 as uuid, validate as isUuid } from "uuid";
import { deleteConversationApi } from "../../api/conversations-client";
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
const RETRYABLE_STATUSES = [423, 429, 503];
// locked by a running (or crashed) turn, skip this chat for now and try the next one
const BUSY_STATUS = 423;
const MIGRATION_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2_000;
// a proxy may send a huge Retry-After, never sleep longer than this per retry
const MAX_RETRY_DELAY_MS = 10_000;
// total sleep per migration run, the history listing waits for the migration
const RETRY_BUDGET_MS = 15_000;

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

/** Local IDs confirmed by the server during this migration pass. */
export interface ChatMigrationResult {
    migratedIds: Set<string>;
}

type LocalChat = DBObject<ChatResponse, unknown>;

export function importConversationApi(payload: ImportConversationPayload): Promise<{ status: "imported" | "skipped" }> {
    return handleApiRequest(() => fetch(API_BASE + "v1/conversations/import", { ...postConfig(payload), cache: "no-store" }), "Failed to import conversation");
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Shared by all chats of one migration run, so retries can't hold up the history listing for long. */
interface RetryBudget {
    remainingMs: number;
}

async function importWithRetry(payload: ImportConversationPayload, budget: RetryBudget): Promise<{ status: "imported" | "skipped" }> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await importConversationApi(payload);
        } catch (error) {
            if (!(error instanceof ApiError) || !RETRYABLE_STATUSES.includes(error.status) || attempt >= MIGRATION_RETRY_ATTEMPTS) {
                throw error;
            }
            const waitMs = Math.min(error.retryAfter !== undefined ? error.retryAfter * 1_000 : DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS);
            if (waitMs > budget.remainingMs) throw error;
            budget.remainingMs -= waitMs;
            await delay(waitMs);
        }
    }
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

/**
 * Mark as persisted without touching _last_edited (update() would bump it and mess up the order).
 * Returns false when the chat was deleted locally while the import ran, it must not come back.
 */
async function markPersisted(storage: StorageService<ChatResponse, unknown>, chat: LocalChat, newId: string): Promise<boolean> {
    const originalId = chat.id;
    if (!originalId) return false;
    const db = await storage.connectToDB();
    try {
        // A previous retry may have allowed a regular persisted turn to finish.
        // Keep that current record rather than replacing it with the old import snapshot.
        const tx = db.transaction(storage.config.objectStore_name, "readwrite");
        const currentChat = await tx.store.get(originalId);
        if (!currentChat) {
            await tx.done;
            return false;
        }
        // One transaction ensures a re-keyed chat never exists twice locally.
        const writes: Promise<unknown>[] = [tx.store.put({ ...currentChat, id: newId, backendPersisted: true })];
        if (newId !== originalId) writes.push(tx.store.delete(originalId));
        await Promise.all([...writes, tx.done]);
        return true;
    } finally {
        db.close();
    }
}

let pending: Promise<ChatMigrationResult> | undefined;

/** Upload every local-only chat once; safe to call on every start. */
export function migrateLocalChatsToBackend(): Promise<ChatMigrationResult> {
    pending ??= migrate().finally(() => {
        pending = undefined;
    });
    return pending;
}

async function migrate(): Promise<ChatMigrationResult> {
    const counts = { imported: 0, skipped: 0, keptLocal: 0, busy: 0 };
    const migratedIds = new Set<string>();
    const retryBudget: RetryBudget = { remainingMs: RETRY_BUDGET_MS };
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
                const { status } = await importWithRetry(
                    {
                        conversation_id: conversationId,
                        title: (chat.name?.trim() || FALLBACK_TITLE).slice(0, MAX_TITLE_CHARS),
                        assistant_id: key.assistantId,
                        last_edited: chat._last_edited ? new Date(chat._last_edited).toISOString() : undefined,
                        turns
                    },
                    retryBudget
                );
                counts[status]++;
            } catch (error) {
                if (error instanceof ApiError && KEEP_LOCAL_STATUSES.includes(error.status)) {
                    counts.keptLocal++;
                    continue;
                }
                if (error instanceof ApiError && error.status === BUSY_STATUS) {
                    // only this chat is locked, the others can still go; it is retried on the next start
                    counts.busy++;
                    continue;
                }
                // network, server or auth trouble, try again on the next start
                console.warn("Chat migration paused, retrying on next start", error);
                return { migratedIds };
            }
            if (await markPersisted(storage, chat, newId)) {
                migratedIds.add(newId);
            } else {
                // deleted locally while the import ran, its server delete may have come too early (404)
                await deleteConversationApi(conversationId).catch(error => console.warn("Could not delete a chat removed during migration", error));
            }
        }
    }
    if (counts.imported || counts.skipped || counts.keptLocal || counts.busy) console.info("Chat migration", counts);
    return { migratedIds };
}
