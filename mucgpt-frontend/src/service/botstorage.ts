import { StorageService, DBMessage } from "./storage";
import { Bot, ChatResponse } from "../api";
import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";

/**
 * Service for storing and retrieving bot configurations and chat messages.
 *
 * each bot as configuration and multiple chats with messages
 * the configuration is a object in the objectstore with the id "BOTCONFIG_<bot_id>"
 * the chats are objects in the objectstore with the id "CHAT_<bot_id>_<chat_id>"
 */
export class BotStorageService {
    // service to handling with the indexeddb
    private storageService: StorageService<ChatResponse, Bot>;
    // contains the name of the bot indexeddb and the corresponding object store
    private config: IndexedDBStorage;
    static CONFIG_ID = "BOTCONFIG_";
    static CHAT_ID = "CHAT_";

    constructor(config: IndexedDBStorage) {
        this.storageService = new StorageService<ChatResponse, Bot>(config);
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
        return new StorageService<ChatResponse, Bot>(this.config);
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
        return BotStorageService.CONFIG_ID + id;
    }

    static GENERATE_BOT_CHAT_PREFIX(bot_id: string) {
        return BotStorageService.CHAT_ID + bot_id + "_";
    }

    static GENERATE_BOT_CHAT_ID(bot_id: string, chat_id?: string) {
        return BotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id) + chat_id;
    }

    /****************************
     * Bot config
     ***************************/

    async createBotConfig(bot_config: Bot, id: string = uuid()) {
        const config_with_id = { ...bot_config, ...{ id: id } };
        await this.storageService.create([], config_with_id, BotStorageService.GENERATE_BOT_CONFIG_ID(id));
        return id;
    }

    async getBotConfig(bot_id: string) {
        return await this.storageService.get(BotStorageService.GENERATE_BOT_CONFIG_ID(bot_id)).then(bot_config => {
            if (bot_config) return bot_config.config;
            else return undefined;
        });
    }

    async setBotConfig(bot_id: string, bot_config: Bot) {
        await this.storageService.update(
            BotStorageService.GENERATE_BOT_CONFIG_ID(bot_id),
            undefined,
            bot_config,
            undefined,
            BotStorageService.GENERATE_BOT_CONFIG_ID(bot_id)
        );
    }

    async getAllBotConfigs() {
        const bots = await this._getAllChatsAndConfigs((id: string) => id.startsWith(BotStorageService.CONFIG_ID));
        const bot_configs = bots.map(config => {
            return config.config;
        });
        return bot_configs;
    }

    /****************************
     * Chats
     ***************************/

    async createChat(bot_id: string, messages: DBMessage<ChatResponse>[], chatname: string) {
        const storageService = new StorageService<ChatResponse, Bot>(this.config);
        const id = BotStorageService.GENERATE_BOT_CHAT_ID(bot_id, uuid());
        await storageService.create(messages, undefined, id, chatname, false);
        return id;
    }

    async getNewestChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(BotStorageService.CONFIG_ID) && id.startsWith(BotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        if (results && results.length > 0) {
            const newest_chat = results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
            return newest_chat;
        } else return undefined;
    }

    async getAllChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(BotStorageService.CONFIG_ID) && id.startsWith(BotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        return results;
    }

    /****************************
     * Delete
     ***************************/

    async deleteConfigAndChatsForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => id === BotStorageService.GENERATE_BOT_CONFIG_ID(bot_id) || id.startsWith(BotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id))
        );
        for (let i = 0; i < results.length; i++) {
            if (results[i].id) {
                await this.storageService.delete(results[i].id ?? "");
            }
        }
    }

    async deleteChatsForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs((id: string) => id.startsWith(BotStorageService.GENERATE_BOT_CHAT_PREFIX(bot_id)));
        for (let i = 0; i < results.length; i++) {
            if (results[i].id) {
                await this.storageService.delete(results[i].id ?? "");
            }
        }
    }
}
