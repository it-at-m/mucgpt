import { AssistantStorageService } from "../../service/assistantstorage";
import { StorageService, type DBObject } from "../../service/storage";
import { ASSISTANT_STORE, CHAT_STORE } from "../../constants";
import type { Assistant, ChatResponse } from "../../api";
import { getOwnedCommunityAssistants } from "../../api/assistant-client";

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

    async getAllHistoryEntries(): Promise<UnifiedHistoryEntry[]> {
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
