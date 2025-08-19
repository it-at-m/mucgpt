import { StorageService, DBMessage } from "./storage";
import { Assistant, ChatResponse } from "../api";
import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";

/**
 * Service for storing and retrieving assistant configurations and chat messages.
 *
 * each assistant as configuration and multiple chats with messages
 * the configuration is a object in the objectstore with the id "BOTCONFIG_<assistant_id>"
 * the chats are objects in the objectstore with the id "CHAT_<assistant_id>_<chat_id>"
 */
export class AssistantStorageService {
    // service to handling with the indexeddb
    private storageService: StorageService<ChatResponse, Assistant>;
    // contains the name of the assistant indexeddb and the corresponding object store
    private config: IndexedDBStorage;
    static CONFIG_ID = "BOTCONFIG_";
    static CHAT_ID = "CHAT_";

    constructor(config: IndexedDBStorage) {
        this.storageService = new StorageService<ChatResponse, Assistant>(config);
        this.config = config;
    }

    /****************************
     * Helper methods
     ***************************/

    /**
     * Returns a new instance of the StorageService class for chat storage.
     * @param chat_id - Optional chat ID.
     * @returns A new instance of the StorageService class.
     */
    getChatStorageService() {
        return new StorageService<ChatResponse, Assistant>(this.config);
    }

    /**
     * Retrieves all chats and configurations that match the provided filter predicate.
     * @param filter_predicate - A function that takes an ID and returns a boolean indicating whether the ID matches the desired criteria.
     * @returns An array of chats and configurations that match the filter predicate.
     */
    private async _getAllChatsAndConfigs(filter_predicate: (id: string) => boolean) {
        const results = await this.storageService.getAll();
        if (results)
            return results.filter(config => {
                if (config.id) {
                    return filter_predicate(config.id);
                }
                return false;
            });
        else return [];
    }

    /****************************
     * Create IDs
     ***************************/

    static GENERATE_BOT_CONFIG_ID(id: string) {
        return AssistantStorageService.CONFIG_ID + id;
    }

    static GENERATE_BOT_CHAT_PREFIX(assistant_id: string) {
        return AssistantStorageService.CHAT_ID + assistant_id + "_";
    }

    static GENERATE_BOT_CHAT_ID(assistant_id: string, chat_id?: string) {
        return AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id) + chat_id;
    }

    /****************************
     * Assistant config
     ***************************/

    async createAssistantConfig(assistant_config: Assistant, id: string = uuid()) {
        const config_with_id = { ...assistant_config, ...{ id: id } };
        await this.storageService.create([], config_with_id, AssistantStorageService.GENERATE_BOT_CONFIG_ID(id));
        return id;
    }

    async getAssistantConfig(assistant_id: string) {
        return await this.storageService.get(AssistantStorageService.GENERATE_BOT_CONFIG_ID(assistant_id)).then(assistant_config => {
            if (assistant_config) return assistant_config.config;
            else return undefined;
        });
    }

    async setAssistantConfig(assistant_id: string, assistant_config: Assistant) {
        await this.storageService.update(
            AssistantStorageService.GENERATE_BOT_CONFIG_ID(assistant_id),
            undefined,
            assistant_config,
            undefined,
            AssistantStorageService.GENERATE_BOT_CONFIG_ID(assistant_id)
        );
    }

    async getAllAssistantConfigs() {
        const assistants = await this._getAllChatsAndConfigs((id: string) => id.startsWith(AssistantStorageService.CONFIG_ID));
        const assistant_configs = assistants.map(config => {
            return config.config;
        });
        return assistant_configs;
    }

    /****************************
     * Chats
     ***************************/

    async createChat(assistant_id: string, messages: DBMessage<ChatResponse>[], chatname: string) {
        const storageService = new StorageService<ChatResponse, Assistant>(this.config);
        const id = AssistantStorageService.GENERATE_BOT_CHAT_ID(assistant_id, uuid());
        await storageService.create(messages, undefined, id, chatname, false);
        return id;
    }

    async getNewestChatForAssistant(assistant_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(AssistantStorageService.CONFIG_ID) && id.startsWith(AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id))
        );
        if (results && results.length > 0) {
            const newest_chat = results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
            return newest_chat;
        } else return undefined;
    }

    async getAllChatForAssistant(assistant_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(AssistantStorageService.CONFIG_ID) && id.startsWith(AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id))
        );
        return results;
    }

    /****************************
     * Delete
     ***************************/

    async deleteConfigAndChatsForAssistant(assistant_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) =>
                id === AssistantStorageService.GENERATE_BOT_CONFIG_ID(assistant_id) ||
                id.startsWith(AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id))
        );
        for (let i = 0; i < results.length; i++) {
            if (results[i].id) {
                await this.storageService.delete(results[i].id ?? "");
            }
        }
    }

    async deleteChatsForAssistant(assistant_id: string) {
        const results = await this._getAllChatsAndConfigs((id: string) => id.startsWith(AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id)));
        for (let i = 0; i < results.length; i++) {
            if (results[i].id) {
                await this.storageService.delete(results[i].id ?? "");
            }
        }
    }
}
