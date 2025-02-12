import { StorageService, DBMessage } from "./storage";
import { Bot, ChatResponse } from "../api";
import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";
import { version } from "os";

/**
 * Service for storing and retrieving Bot configurations and chat messages.
 *
 * each Bot as configuration and multiple chats with messages
 * the configuration is a object in the objectstore with the id "BOTCONFIG_<bot_id>"
 * the chats are objects in the objectstore with the id "CHAT_<bot_id>_<chat_id>"
 */
export class CommunityBotStorageService {
    // service to handling with the indexeddb
    private storageService: StorageService<ChatResponse, Bot>;
    // contains the name of the Bot indexeddb and the corresponding object store
    private config: IndexedDBStorage;
    static CONFIG_ID = "COMMUNITYBOTCONFIG_";
    static CHAT_ID = "CHAT_";

    constructor(config: IndexedDBStorage) {
        this.storageService = new StorageService<ChatResponse, Bot>(config, undefined);
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
    getChatStorageService(chat_id?: string) {
        return new StorageService<ChatResponse, Bot>(this.config, chat_id);
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
        return CommunityBotStorageService.CONFIG_ID + id;
    }

    static GENERATE_BOT_CHAT_PREFIX(bot_id: string) {
        return CommunityBotStorageService.CHAT_ID + bot_id + "_";
    }

    static GENERATE_BOT_CHAT_ID(bot_id: string, chat_id?: string) {
        return CommunityBotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id) + chat_id;
    }

    /****************************
     * Bot config
     ***************************/

    async createBotConfig(bot_config: Bot) {
        await this.storageService.create([], bot_config, CommunityBotStorageService.GENERATE_BOT_CONFIG_ID(bot_config.id), bot_config.id);
    }

    async updateBotConfig(bot_config: Bot) {
        this.getBotConfig(bot_config.id).then(async config => {
            if (config !== undefined) {
                await this.storageService.update(undefined, bot_config, CommunityBotStorageService.GENERATE_BOT_CONFIG_ID(bot_config.id));
            } else {
                await this.createBotConfig(bot_config);
            }
        });
    }

    async getBotConfig(bot_id: string) {
        return await this.storageService.get(CommunityBotStorageService.GENERATE_BOT_CONFIG_ID(bot_id)).then(bot_config => {
            if (bot_config) return bot_config.config;
            else return undefined;
        });
    }

    async setBotConfig(bot_id: string, bot_config: Bot) {
        await this.storageService.update(undefined, bot_config, CommunityBotStorageService.GENERATE_BOT_CONFIG_ID(bot_id));
    }

    async getAllBotConfigs() {
        const bots = await this._getAllChatsAndConfigs((id: string) => id.startsWith(CommunityBotStorageService.CONFIG_ID));
        const bot_configs = bots.map(config => {
            return config.config;
        });
        return bot_configs;
    }

    /****************************
     * Chats
     ***************************/

    async createChat(bot_id: string, messages: DBMessage<ChatResponse>[], chatname: string) {
        const storageService = new StorageService<ChatResponse, Bot>(this.config, CommunityBotStorageService.GENERATE_BOT_CHAT_ID(bot_id, undefined));
        const id = CommunityBotStorageService.GENERATE_BOT_CHAT_ID(bot_id, uuid());
        await storageService.create(messages, undefined, id, chatname, false);
        return id;
    }

    async getNewestChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(CommunityBotStorageService.CONFIG_ID) && id.startsWith(CommunityBotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        if (results && results.length > 0) {
            const newest_chat = results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
            return newest_chat;
        } else return undefined;
    }

    async getAllChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(CommunityBotStorageService.CONFIG_ID) && id.startsWith(CommunityBotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        return results;
    }

    /****************************
     * Delete
     ***************************/

    async deleteConfigAndChatsForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) =>
                id === CommunityBotStorageService.GENERATE_BOT_CONFIG_ID(bot_id) || id.startsWith(CommunityBotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        for (let i = 0; i < results.length; i++) {
            await this.storageService.delete(results[i].id);
        }
    }

    /****************************
     * Change ID of Bot
     ***************************/

    async changeBotId(old_id: string, new_id: string) {
        const config = await this.getBotConfig(old_id);
        if (config) {
            const newConfig: Bot = {
                id: new_id,
                title: config.title,
                version: config.version,
                description: config.description,
                system_message: config.system_message,
                publish: config.publish,
                temperature: config.temperature,
                max_output_tokens: config.max_output_tokens,
                tags: config.tags,
                owner: config.owner
            };
            await this.createBotConfig(newConfig);
            // change id of all chats
            const chats = await this.getAllChatForBot(old_id);
            for (let i = 0; i < chats.length; i++) {
                const chat = chats[i];
                await this.createChat(new_id, chat.messages, chat.name || "Chat " + i);
            }
            await this.deleteConfigAndChatsForBot(old_id);
        }
    }
}
