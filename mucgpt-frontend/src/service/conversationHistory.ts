import { listConversationsApi, getConversationMessagesApi, type ConversationMessage } from "../api/conversations-client";
import { ApiError } from "../api/fetch-utils";
import type { Assistant, ChatResponse } from "../api/models";
import { ASSISTANT_STORE, CHAT_STORE, CREATIVITY_LOW } from "../constants";
import { AssistantStorageService } from "./assistantstorage";
import { StorageService, type DBMessage, type DBObject } from "./storage";

interface ChatOptions {
    system: string;
    creativity: string;
}

// Cache metadata without downloading every transcript. Existing browser-only
// chats, settings, names and favourites remain available.
let pendingSync: Promise<void> | undefined;

/** Share an in-flight metadata sync; a settled failure permits a later retry. */
export function syncConversationHistory(): Promise<void> {
    pendingSync ??= syncHistory().finally(() => {
        pendingSync = undefined;
    });
    return pendingSync;
}

/** Reconcile live server metadata while retaining local-only chats and browser preferences. */
async function syncHistory(): Promise<void> {
    const conversations = await listConversationsApi();
    const chatStorage = new StorageService<ChatResponse, ChatOptions>(CHAT_STORE);
    const assistantStorage = new StorageService<ChatResponse, Assistant>(ASSISTANT_STORE);
    const [chats, assistantChats] = await Promise.all([chatStorage.getAll(), assistantStorage.getAll()]);
    const localChats = new Map((chats ?? []).map(chat => [chat.id, chat]));
    const localAssistantChats = new Map((assistantChats ?? []).map(chat => [chat.id, chat]));
    const serverIds = new Set(conversations.map(conversation => conversation.conversation_id));

    // Remove only entries known to have been synchronized before. Local-only
    // history is retained when a chat has been deleted from another device.
    for (const chat of chats ?? []) {
        if (chat.backendPersisted && chat.id && !serverIds.has(chat.id)) {
            await chatStorage.delete(chat.id);
        }
    }
    for (const chat of assistantChats ?? []) {
        if (!chat.backendPersisted || !chat.id) continue;
        const conversationId = chat.id.slice(chat.id.lastIndexOf("_") + 1);
        if (!serverIds.has(conversationId)) {
            await assistantStorage.delete(chat.id);
        }
    }

    for (const conversation of conversations) {
        // Legacy rows may lack assistant_id; recover the local association when
        // this browser still knows it, rather than showing a duplicate normal chat.
        const localAssistantChat = (assistantChats ?? []).find(
            chat => chat.id?.startsWith(AssistantStorageService.CHAT_ID) && chat.id.endsWith("_" + conversation.conversation_id)
        );
        const isAssistant = Boolean(conversation.assistant_id || localAssistantChat);
        const id = conversation.assistant_id
            ? AssistantStorageService.GENERATE_BOT_CHAT_ID(conversation.assistant_id, conversation.conversation_id)
            : (localAssistantChat?.id ?? conversation.conversation_id);
        const existing = isAssistant ? localAssistantChats.get(id) : localChats.get(id);
        const record = {
            ...existing,
            id,
            backendPersisted: true,
            name: existing?.name ?? conversation.title,
            favorite: existing?.favorite ?? false,
            messages: existing?.messages ?? [],
            config: existing?.config ?? (isAssistant ? {} : { system: "", creativity: CREATIVITY_LOW }),
            _last_edited: Math.max(existing?._last_edited ?? 0, Date.parse(conversation.updated_at))
        };
        const storage = isAssistant ? assistantStorage : chatStorage;
        const db = await storage.connectToDB();
        try {
            await db.put(storage.config.objectStore_name, record);
        } finally {
            db.close();
        }
    }
}

/** Group display messages into browser turns, preserving interrupted questions, usage, and tool activity. */
export function toChatTurns(messages: ConversationMessage[]): DBMessage<ChatResponse>[] {
    const turns: DBMessage<ChatResponse>[] = [];
    for (const message of messages) {
        if (message.role === "user") {
            turns.push({ user: message.content, response: { answer: "" } });
        } else if (message.role === "assistant" && turns.length > 0) {
            const turn = turns[turns.length - 1];
            turn.response.answer += (turn.response.answer ? "\n\n" : "") + message.content;
        }
        if (message.activity_steps?.length && turns.length > 0 && message.role !== "system") {
            const response = turns[turns.length - 1].response;
            response.activitySteps = [
                ...(response.activitySteps ?? []),
                ...message.activity_steps.map(step => ({
                    toolCallId: step.tool_call_id,
                    toolName: step.tool_name,
                    status: step.status,
                    ...(step.description ? { description: step.description } : {}),
                    ...(step.detail ? { detail: step.detail } : {})
                }))
            ];
        }
        if (message.usage && turns.length > 0 && message.role !== "system") {
            const response = turns[turns.length - 1].response;
            // Missing legacy fields must not overwrite valid local metadata.
            Object.assign(response, Object.fromEntries(Object.entries(message.usage).filter(([, value]) => value !== null && value !== undefined)));
        }
    }
    return turns;
}

/**
 * Refresh a transcript from the server and cache it, preserving matching local-only metadata.
 * A nonempty cache is used on 404, or on 403 only for browser-only chats. Other
 * failures propagate; known persisted chats never fall back on authorization denial.
 */
export async function loadConversation<C>(
    storage: StorageService<ChatResponse, C>,
    id: string,
    conversationId: string,
    defaultConfig: C
): Promise<DBObject<ChatResponse, C>> {
    const cached = await storage.get(id);
    let messages: ConversationMessage[];
    try {
        messages = await getConversationMessagesApi(conversationId);
    } catch (error) {
        // The backend returns 403 for an unknown ownership row and 404 for a
        // missing checkpoint. Allow legacy browser-only history in either case;
        // known server chats must still surface authorization failures.
        if (error instanceof ApiError && cached?.messages.length && (error.status === 404 || (error.status === 403 && !cached.backendPersisted))) {
            return cached;
        }
        throw error;
    }
    const chat: DBObject<ChatResponse, C> = {
        ...cached,
        id,
        backendPersisted: true,
        messages: toChatTurns(messages).map((turn, index) => {
            const local = cached?.messages[index];
            if (local?.user !== turn.user || local.response.answer !== turn.response.answer) return turn;
            // Server usage and steps take precedence; keep legacy local metadata
            // and step timings only for this matching transcript and tool call.
            const localSteps = new Map(local.response.activitySteps?.map(step => [step.toolCallId, step]));
            return {
                ...turn,
                response: {
                    ...local.response,
                    ...turn.response,
                    activitySteps: turn.response.activitySteps?.map(step => ({ ...localSteps.get(step.toolCallId), ...step })) ?? local.response.activitySteps
                }
            };
        }),
        config: cached?.config ?? defaultConfig
    };
    const db = await storage.connectToDB();
    try {
        await db.put(storage.config.objectStore_name, chat);
    } finally {
        db.close();
    }
    return chat;
}
