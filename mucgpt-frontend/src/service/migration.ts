import { IDBPDatabase, IDBPTransaction } from "idb";
import { ChatResponse } from "../api";
import { ASSISTANT_STORE, CHAT_STORE, LEGACY_ASSISTANT_STORE } from "../constants";
import { ChatOptions } from "../pages/chat/Chat";
import { AssistantStorageService } from "./assistantstorage";
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
        temperature: number;
    };
}

export interface LegacyAssistant {
    title: string;
    description: string;
    system_message: string;
    publish: boolean;
    id: number;
    temperature: number;
}
export async function migrate_old_assistants() {
    const legacy_store = new StorageService<any, any>(LEGACY_ASSISTANT_STORE);
    const db = await legacy_store.connectToDB();
    const newStore = new AssistantStorageService(ASSISTANT_STORE);
    if (db.objectStoreNames.contains(LEGACY_ASSISTANT_STORE.objectStore_name)) {
        const oldassistants: LegacyAssistant[] = (await db.getAll(LEGACY_ASSISTANT_STORE.objectStore_name)) as LegacyAssistant[];
        await db.clear(LEGACY_ASSISTANT_STORE.objectStore_name);
        for (const oldassistant of oldassistants) {
            if (oldassistant.id == 0 || oldassistant.id == 1) continue; //skip the default assistants
            const newAssistant = {
                title: oldassistant.title,
                description: oldassistant.description,
                system_message: oldassistant.system_message,
                publish: oldassistant.publish,
                temperature: oldassistant.temperature,
                version: "0", // Set a default version for new assistants
                is_visible: true
            };
            //save to new assistant storage
            await newStore.createAssistantConfig(newAssistant);
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
                for (const chat of oldchats) {
                    const newChat: DBObject<ChatResponse, ChatOptions> = {
                        messages: chat.Data.Answers.map(answer => {
                            return {
                                user: answer[0],
                                response: { answer: answer[1].answer, tokens: answer[1].tokens, user_tokens: answer[2] }
                            };
                        }),
                        config: {
                            system: chat.Options.system,
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
