import { StorageService, DBObject, DBMessage } from "./storage";
import { Bot, ChatResponse } from "../api";
import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";

export class BotStorageService {
    storageService: StorageService<ChatResponse, Bot>;
    config: IndexedDBStorage;
    static CONFIG_ID = "BOTCONFIG_";
    static CHAT_ID = "CHAT_";

    constructor(config: IndexedDBStorage) {
        this.storageService = new StorageService<ChatResponse, Bot>(config, undefined);
        this.config = config;
    }

    static constructConfigID(id: string) {
        return BotStorageService.CONFIG_ID + id;
    }

    static constructBotChatPrefix(bot_id: string) {
        return BotStorageService.CHAT_ID + bot_id + "_";
    }

    static constructChatID(bot_id: string, chat_id?: string) {
        return BotStorageService.constructBotChatPrefix(bot_id) + chat_id;
    }

    async createBot(bot_config: Bot, id: string = uuid()) {
        let config_with_id = { ...bot_config, ...{ id: id } };
        await this.storageService.create([], config_with_id, BotStorageService.constructConfigID(id));
        return id;
    }

    async getBotConfig(bot_id: string) {
        return await this.storageService.get(BotStorageService.constructConfigID(bot_id)).then(bot_config => {
            if (bot_config) return bot_config.config;
            else return undefined;
        });
    }

    getChatStorageService(bot_id: string, active_chat?: string) {
        return new StorageService<ChatResponse, Bot>(this.config, BotStorageService.constructChatID(bot_id, active_chat));
    }

    async createChat(bot_id: string, messages: DBMessage<ChatResponse>[], chatname: string) {
        const storageService = this.getChatStorageService(bot_id, undefined);
        const id = BotStorageService.constructChatID(bot_id, uuid());
        await storageService.create(messages, undefined, id, chatname, false);
        return id;
    }

    async appendMessage(bot_id: string, chat_id: string, message: DBMessage<ChatResponse>) {
        const storageService = this.getChatStorageService(bot_id, chat_id);
        await storageService.appendMessage(message);
    }

    async _getAllChatsAndConfigs(filter_predicate: (id: string) => boolean) {
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

    async getNewestChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(BotStorageService.CONFIG_ID) && id.startsWith(BotStorageService.constructBotChatPrefix(bot_id))
        );
        if (results && results.length > 0) {
            const newest_chat = results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
            return newest_chat;
        } else return undefined;
    }

    async getAllChatForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => !id.startsWith(BotStorageService.CONFIG_ID) && id.startsWith(BotStorageService.constructBotChatPrefix(bot_id))
        );
        return results;
    }

    async getConfigAndChat(bot_id: string, chat_id: string): Promise<DBObject<ChatResponse, Bot> | undefined> {
        let chat = await this.storageService.get(chat_id);
        let config = await this.getBotConfig(bot_id);
        if (config && chat) return { ...chat, config: config };
        else {
            console.warn("Bot or chat not found");
            return undefined;
        }
    }

    async getAllBotConfigs() {
        const bots = await this._getAllChatsAndConfigs((id: string) => id.startsWith(BotStorageService.CONFIG_ID));
        const bot_configs = bots.map(config => {
            return config.config;
        });
        return bot_configs;
    }

    async deleteConfigAndChatsForBot(bot_id: string) {
        const results = await this._getAllChatsAndConfigs(
            (id: string) => id === BotStorageService.constructConfigID(bot_id) || id.startsWith(BotStorageService.constructBotChatPrefix(bot_id))
        );
        for (let i = 0; i < results.length; i++) {
            await this.storageService.delete(results[i].id);
        }
    }
}
