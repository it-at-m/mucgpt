import { IDBPDatabase, IDBPTransaction } from "idb";
import { ChatResponse } from "../api";
import { CHAT_STORE, CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../constants";
import { ChatOptions } from "../pages/chat/Chat";
import { DBObject } from "./storage";

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

function convertChatOptionsToCreativity(temperature: number): string {
    if (temperature < 0.4) return CREATIVITY_LOW;
    if (temperature >= 0.8) return CREATIVITY_HIGH;
    return CREATIVITY_MEDIUM;
}

export function convertTemperatureToCreativity(temperature: number): string {
    if (temperature < 0.4) return CREATIVITY_LOW;
    if (temperature >= 0.8) return CREATIVITY_HIGH;
    return CREATIVITY_MEDIUM;
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
                            creativity: convertChatOptionsToCreativity(chat.Options.temperature)
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
