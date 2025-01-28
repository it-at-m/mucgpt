import { IDBPDatabase, IDBPTransaction } from "idb";
import { ChatResponse } from "../api";
import { BOT_STORE, CHAT_STORE, LEGACY_BOT_STORE } from "../constants";
import { ChatOptions } from "../pages/chat/Chat";
import { BotStorageService } from "./botstorage";
import { DBObject, StorageService } from "./storage";

interface LegacyChatObject {
    id: string;
    Data: {
        Answers: [string, { answer: string; tokens: number }, number][];
        LastEdited: number;
        Name: string;
    };
    Options: {
        favorite: boolean;
        system: string;
        maxTokens: number;
        temperature: number;
    };
}

export interface LegacyBot {
    title: string;
    description: string;
    system_message: string;
    publish: boolean;
    id: number;
    temperature: number;
    max_output_tokens: number;
}
export async function migrate_old_bots() {
    const legacy_store = new StorageService<any, any>(LEGACY_BOT_STORE, undefined);
    const db = await legacy_store.connectToDB();
    const newStore = new BotStorageService(BOT_STORE);
    if (db.objectStoreNames.contains(LEGACY_BOT_STORE.objectStore_name)) {
        const oldbots: LegacyBot[] = (await db.getAll(LEGACY_BOT_STORE.objectStore_name)) as LegacyBot[];
        await db.clear(LEGACY_BOT_STORE.objectStore_name);
        for (let oldbot of oldbots) {
            debugger;
            if (oldbot.id == 0 || oldbot.id == 1) continue; //skip the default bots
            let newBot = {
                title: oldbot.title,
                description: oldbot.description,
                system_message: oldbot.system_message,
                publish: oldbot.publish,
                temperature: oldbot.temperature,
                max_output_tokens: oldbot.max_output_tokens
            };
            //save to new bot storage
            await newStore.createBotConfig(newBot);
        }
    }
}

export async function migrateChats(
    db: IDBPDatabase<any>,
    _oldVersion: number,
    _newVersion: number | null,
    transaction: IDBPTransaction<any, string[], "versionchange">,
    _event: IDBVersionChangeEvent,
    storeName: string
) {
    if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
    } else {
        if (storeName === CHAT_STORE.objectStore_name && _oldVersion == 2) {
            transaction.oncomplete = async () => {
                const oldchats: LegacyChatObject[] = (await db.getAll(storeName)) as [LegacyChatObject];
                for (let chat of oldchats) {
                    let newChat: DBObject<ChatResponse, ChatOptions> = {
                        messages: chat.Data.Answers.map(answer => {
                            return {
                                user: answer[0],
                                response: { answer: answer[1].answer, tokens: answer[1].tokens, user_tokens: answer[2] }
                            };
                        }),
                        config: {
                            system: chat.Options.system,
                            maxTokens: chat.Options.maxTokens,
                            temperature: chat.Options.temperature
                        },
                        _last_edited: chat.Data.LastEdited,
                        id: chat.id,
                        name: chat.Data.Name,
                        favorite: chat.Options.favorite
                    };
                    await db.put(storeName, newChat);
                }
            };
        } else transaction.objectStore(storeName).clear();
    }
}
