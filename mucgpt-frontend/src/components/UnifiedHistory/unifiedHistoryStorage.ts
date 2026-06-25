import { AssistantStorageService } from "../../service/assistantstorage";
import { StorageService, type DBObject, type DBMessage } from "../../service/storage";
import { ASSISTANT_STORE, CHAT_STORE, CREATIVITY_MEDIUM } from "../../constants";
import type { Assistant, ChatResponse, ConversationMessage } from "../../api";
import { getOwnedCommunityAssistants } from "../../api/assistant-client";
import { createConversation, deleteConversation, getConversation, listConversations, patchConversation } from "../../api/conversations-client";

/** Pair backend (role, content) messages back into the local user→response shape. */
const backendMessagesToDbMessages = (messages: ConversationMessage[]): DBMessage<ChatResponse>[] => {
    const result: DBMessage<ChatResponse>[] = [];
    let pendingUser: string | null = null;
    for (const message of messages) {
        if (message.role === "system") {
            continue;
        }
        if (message.role === "user") {
            if (pendingUser !== null) {
                result.push({ user: pendingUser, response: { answer: "" } });
            }
            pendingUser = message.content;
        } else {
            result.push({ user: pendingUser ?? "", response: { answer: message.content } });
            pendingUser = null;
        }
    }
    if (pendingUser !== null) {
        result.push({ user: pendingUser, response: { answer: "" } });
    }
    return result;
};

/** Flatten local user→response turns into the backend's ordered message list. */
const dbMessagesToBackendMessages = (messages: DBMessage<ChatResponse>[]): ConversationMessage[] => {
    const result: ConversationMessage[] = [];
    for (const message of messages) {
        result.push({ role: "user", content: message.user ?? "" });
        result.push({ role: "assistant", content: message.response?.answer ?? "" });
    }
    return result;
};

interface StoredChatOptions {
    system: string;
    creativity: string;
}

export type UnifiedHistoryEntryKind = "chat" | "assistant";

export interface UnifiedHistoryEntry {
    id: string;
    kind: UnifiedHistoryEntryKind;
    assistantId?: string;
    name?: string;
    favorite?: boolean;
    lastEdited: number;
}

export const getAssistantIdFromChatId = (chatId: string): string | undefined => {
    if (!chatId.startsWith(AssistantStorageService.CHAT_ID)) {
        return undefined;
    }

    const idWithoutPrefix = chatId.slice(AssistantStorageService.CHAT_ID.length);
    const separatorIndex = idWithoutPrefix.lastIndexOf("_");
    if (separatorIndex <= 0) {
        return undefined;
    }

    return idWithoutPrefix.slice(0, separatorIndex);
};

const toNormalHistoryEntry = (chat: DBObject<ChatResponse, StoredChatOptions>): UnifiedHistoryEntry | null => {
    if (!chat.id) {
        return null;
    }

    return {
        id: chat.id,
        kind: "chat",
        name: chat.name,
        favorite: chat.favorite,
        lastEdited: chat._last_edited ?? 0
    };
};

const toAssistantHistoryEntry = (chat: DBObject<ChatResponse, Assistant>): UnifiedHistoryEntry | null => {
    if (!chat.id || chat.id.startsWith(AssistantStorageService.CONFIG_ID)) {
        return null;
    }

    const assistantId = getAssistantIdFromChatId(chat.id);
    if (!assistantId) {
        return null;
    }

    return {
        id: chat.id,
        kind: "assistant",
        assistantId,
        name: chat.name,
        favorite: chat.favorite,
        lastEdited: chat._last_edited ?? 0
    };
};

export class UnifiedHistoryStorage {
    private readonly chatStorage = new StorageService<ChatResponse, StoredChatOptions>(CHAT_STORE);
    private readonly assistantStorage = new AssistantStorageService(ASSISTANT_STORE);
    private readonly assistantChatStorage = this.assistantStorage.getChatStorageService();
    // De-dupes the reconcile so it runs at most once per instance (and never
    // concurrently). Reset only on failure so a later refresh can retry.
    private syncPromise: Promise<void> | null = null;

    /**
     * Reconcile normal chats with the backend so they persist per-user and are
     * available across sessions/devices:
     *  - pull: backend conversations missing locally are stored in IndexedDB;
     *  - push: local chats not yet on the backend are created there, preserving
     *    their id (a one-time migration of pre-existing local chats).
     * Best-effort: failures are logged and the local store is still usable
     * offline. Assistant chats are intentionally excluded (kept local for now).
     *
     * Guarded so frequent refreshes (e.g. after every message) reuse the single
     * in-flight/completed reconcile instead of hammering the backend or racing
     * into duplicate creates.
     */
    syncWithBackend(): Promise<void> {
        if (this.syncPromise) {
            return this.syncPromise;
        }
        this.syncPromise = this.runSync().catch(error => {
            console.error("Failed to sync conversations with backend", error);
            this.syncPromise = null; // allow a later refresh to retry
        });
        return this.syncPromise;
    }

    private async runSync(): Promise<void> {
        const [backendList, localChats] = await Promise.all([listConversations(), this.chatStorage.getAll()]);
        const local = localChats ?? [];
        const localIds = new Set(local.filter(chat => chat.id).map(chat => chat.id as string));
        const backendIds = new Set(backendList.map(conversation => conversation.id));

        // Count per-conversation failures so a transient pull/push error makes
        // the whole sync fail (below). Otherwise runSync would resolve despite
        // the failure and the resolved syncPromise guard would block any retry
        // until reload, leaving a chat unpulled or unmigrated.
        let failures = 0;

        const pulls = backendList
            .filter(conversation => !localIds.has(conversation.id))
            .map(async conversation => {
                try {
                    const detail = await getConversation(conversation.id);
                    await this.chatStorage.create(
                        backendMessagesToDbMessages(detail.messages),
                        { system: "", creativity: CREATIVITY_MEDIUM },
                        detail.id,
                        detail.title ?? undefined,
                        detail.favorite
                    );
                } catch (error) {
                    failures++;
                    console.error(`Failed to pull conversation "${conversation.id}" from backend`, error);
                }
            });

        const pushes = local
            .filter(chat => chat.id && !backendIds.has(chat.id))
            .map(async chat => {
                try {
                    await createConversation({
                        id: chat.id,
                        title: chat.name,
                        messages: dbMessagesToBackendMessages(chat.messages ?? [])
                    });
                } catch (error) {
                    failures++;
                    console.error(`Failed to migrate local chat "${chat.id}" to backend`, error);
                }
            });

        // Run all pulls/pushes to completion (one failure must not abort the
        // others) but surface an aggregate failure so syncWithBackend() clears
        // the cached promise and a later refresh retries the leftovers.
        await Promise.all([...pulls, ...pushes]);

        if (failures > 0) {
            throw new Error(`Conversation sync finished with ${failures} failed operation(s); will retry on next refresh`);
        }
    }

    async getAllHistoryEntries(): Promise<UnifiedHistoryEntry[]> {
        // Reconcile with the backend so pulled chats appear in the list. The
        // guard makes this a single network round-trip per instance; later
        // refreshes (after each message) reuse the resolved promise and never
        // re-hit the backend. Failures are swallowed so local history still shows.
        await this.syncWithBackend();

        const [normalChats, assistantStoreEntries] = await Promise.all([this.chatStorage.getAll(), this.assistantChatStorage.getAll()]);

        return [
            ...(normalChats ?? []).map(toNormalHistoryEntry).filter((entry): entry is UnifiedHistoryEntry => entry !== null),
            ...(assistantStoreEntries ?? []).map(toAssistantHistoryEntry).filter((entry): entry is UnifiedHistoryEntry => entry !== null)
        ].toSorted((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastEdited - a.lastEdited);
    }

    async deleteEntry(entry: UnifiedHistoryEntry): Promise<void> {
        if (entry.kind === "assistant") {
            const deleted = await this.assistantChatStorage.delete(entry.id);
            if (!deleted) {
                throw new Error(`Failed to delete assistant history entry "${entry.id}"`);
            }
            return;
        }

        const deleted = await this.chatStorage.delete(entry.id);
        if (!deleted) {
            throw new Error(`Failed to delete chat history entry "${entry.id}"`);
        }
        // Mirror the deletion to the backend (best-effort).
        await deleteConversation(entry.id).catch(error => console.error(`Failed to delete conversation "${entry.id}" on backend`, error));
    }

    async renameEntry(entry: UnifiedHistoryEntry, name: string): Promise<void> {
        if (entry.kind === "assistant") {
            const renamed = await this.assistantChatStorage.renameChat(entry.id, name);
            if (!renamed) {
                throw new Error(`Failed to rename assistant history entry "${entry.id}"`);
            }
            return;
        }

        const renamed = await this.chatStorage.renameChat(entry.id, name);
        if (!renamed) {
            throw new Error(`Failed to rename chat history entry "${entry.id}"`);
        }
        // Mirror the new title to the backend (best-effort).
        await patchConversation(entry.id, { title: name }).catch(error => console.error(`Failed to rename conversation "${entry.id}" on backend`, error));
    }

    async changeFavourite(entry: UnifiedHistoryEntry, favorite: boolean): Promise<void> {
        if (entry.kind === "assistant") {
            const updated = await this.assistantChatStorage.changeFavouritesInDb(entry.id, favorite);
            if (!updated) {
                throw new Error(`Failed to update favourite state for assistant history entry "${entry.id}"`);
            }
            return;
        }

        const updated = await this.chatStorage.changeFavouritesInDb(entry.id, favorite);
        if (!updated) {
            throw new Error(`Failed to update favourite state for chat history entry "${entry.id}"`);
        }
        // Mirror the favourite flag to the backend (best-effort).
        await patchConversation(entry.id, { favorite }).catch(error =>
            console.error(`Failed to update favourite for conversation "${entry.id}" on backend`, error)
        );
    }

    async hasLocalAssistantConfig(assistantId: string): Promise<boolean> {
        return (await this.assistantStorage.getAssistantConfig(assistantId)) !== undefined;
    }

    async getAssistantPath(assistantId: string): Promise<string> {
        if (await this.hasLocalAssistantConfig(assistantId)) {
            return `/assistant/${assistantId}`;
        }

        const ownedAssistants = await getOwnedCommunityAssistants().catch(error => {
            console.error("Failed to resolve owned assistant route", error);
            return [];
        });

        return ownedAssistants.some(assistant => assistant.id === assistantId)
            ? `/owned/communityassistant/${assistantId}`
            : `/communityassistant/${assistantId}`;
    }
}
