import { MutableRefObject } from "react";
import { openDB, IDBPDatabase, IDBPTransaction } from "idb";

import { chatApi, handleRedirect } from "../api/api";
import { Bot, ChatRequest, ChatTurn } from "../api/models";

export interface indexedDBStorage {
    db_name: string;
    db_version: number;
    objectStore_name: string;
}
export const CURRENT_CHAT_IN_DB = 0;

// Bot - Storage

export const bot_storage: indexedDBStorage = {
    db_name: "MUCGPT-BOTS",
    objectStore_name: "bots",
    db_version: 3
};
export const bot_history_storage: indexedDBStorage = {
    db_name: "MUCGPT-BOTS-HISTORY",
    objectStore_name: "bots-history",
    db_version: 2
};

export async function onUpgrade(db: IDBPDatabase, storage: indexedDBStorage, transaction: IDBPTransaction<unknown, string[], "versionchange">) {
    let storeName = storage.objectStore_name;
    if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
    } else if (transaction) {
        transaction.objectStore(storeName).clear();
    }
}

export async function onError(request: any) {
    console.error("Error", request.error);
}
export async function connectToDB(storage: indexedDBStorage) {
    return await openDB(storage.db_name, storage.db_version, {
        upgrade(db, _oldVersion, _newVersion, transaction) {
            onUpgrade(db, storage, transaction);
        }
    });
}

export async function saveToDB(
    a: any[],
    storage: indexedDBStorage,
    current_id: number,
    id_counter: number,
    setCurrentId: (id: number) => void,
    setIdCounter: (id: number) => void,
    language?: string,
    temperature?: number,
    system_message?: string,
    max_output_tokens?: number,
    model?: string
) {
    try {
        const db = await connectToDB(storage);
        const stored = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(current_id);

        let data;
        let dataID;
        if (stored) {
            // if the chat already exists in the DB
            dataID = stored.id;
            let storedAnswers = stored.Data.Answers;
            if (storedAnswers.length > 0 && storedAnswers[storedAnswers.length - 1][1].answer == "") {
                storedAnswers[storedAnswers.length - 1][1] = a[1];
            } else {
                storedAnswers.push(a);
            }
            stored.Data.LastEdited = Date.now();
            if (storage.objectStore_name === "chat") {
                stored.Options.system = system_message;
                stored.Options.maxTokens = max_output_tokens;
                stored.Options.temperature = temperature;
            }
            data = stored;
        } else {
            // if the chat does not exist in the DB
            let name: string = "";
            let new_idcounter = id_counter;
            if (language != undefined && temperature != undefined && system_message != undefined && max_output_tokens != undefined && model != undefined) {
                name = await (await _getChatName(a, language, temperature, system_message, max_output_tokens, model)).content;
                name = name.replaceAll('"', "").replaceAll(".", "");
            }
            if (storage.objectStore_name === "chat") {
                // if this function is called by the chat the chat options are also saved
                new_idcounter = new_idcounter + 1;
                setIdCounter(new_idcounter);
                data = {
                    Data: { Answers: [a], Name: name, LastEdited: Date.now() },
                    id: new_idcounter,
                    Options: {
                        favorite: false,
                        system: system_message,
                        maxTokens: max_output_tokens,
                        temperature: temperature
                    }
                };
            } else {
                data = {
                    Data: { Answers: [a], Name: name, LastEdited: Date.now() },
                    id: new_idcounter
                };
            }
            setCurrentId(new_idcounter);
            dataID = new_idcounter;
        }
        const chat = db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        await chat.put(data);
        data["id"] = CURRENT_CHAT_IN_DB;
        data["refID"] = dataID;
        await chat.put(data);
    } catch (error) {
        onError(error);
    }
}

async function _getChatName(answers: any, language: string, temperature: number, system_message: string, max_output_tokens: number, model: string) {
    const history: ChatTurn[] = [{ user: answers[0], bot: answers[1].answer }];
    const request: ChatRequest = {
        history: [
            ...history,
            {
                user: "Gebe dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen, bestehend aus maximal 5 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Antworte nur mit dem vollständigen Namen und keinem weiteren Text, damit deine Antwort direkt weiterverwendet werden kann. Benutze keine Sonderzeichen sondern lediglich Zahlen und Buchstaben. Antworte in keinem Fall mit etwas anderem als dem Chat namen. Antworte immer nur mit dem namen des Chats",
                bot: undefined
            }
        ],
        shouldStream: false,
        language: language,
        temperature: temperature,
        system_message: system_message,
        max_output_tokens: max_output_tokens,
        model: model
    };
    const response = await chatApi(request);
    handleRedirect(response);

    if (!response.body) {
        throw Error("No response body");
    }
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function getStartDataFromDB(storage: indexedDBStorage, id: number): Promise<any> {
    try {
        const db = await connectToDB(storage);
        const result = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(id);
        return result;
    } catch (error) {
        onError(error);
    }
}

export async function deleteChatFromDB(
    storage: indexedDBStorage,
    id: number,
    setAnswers: (answers: []) => void,
    isCurrent: boolean,
    lastQuestionRef: MutableRefObject<string>
) {
    try {
        const db = await connectToDB(storage);
        if (isCurrent) {
            setAnswers([]);
            lastQuestionRef.current = "";
        }
        await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(id);
        if (isCurrent && id != CURRENT_CHAT_IN_DB) {
            await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(CURRENT_CHAT_IN_DB);
        }
    } catch (error) {
        onError(error);
    }
}

export async function checkStructurOfDB(storage: indexedDBStorage) {
    try {
        const db = await connectToDB(storage);
        const storeName = storage.objectStore_name;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
        }
    } catch (error) {
        onError(error);
    }
}

export async function getHighestKeyInDB(storage: indexedDBStorage): Promise<number> {
    try {
        const db = await connectToDB(storage);
        const keys = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).getAllKeys();
        const highestKey = Math.max(...keys.map(Number), 0);
        return highestKey;
    } catch (error) {
        onError(error);
        return 0;
    }
}

// Chat functions

export async function popLastMessageInDB(storage: indexedDBStorage, id: number) {
    try {
        const db = await connectToDB(storage);
        const chat = db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        const stored = await chat.get(id);
        if (stored) {
            await chat.delete(id);
            stored.Data.Answers.pop();
            await chat.put(stored);
        }
    } catch (error) {
        onError(error);
    }
}

export async function getCurrentChatID(storage: indexedDBStorage): Promise<number | undefined> {
    try {
        const db = await connectToDB(storage);
        const result = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(CURRENT_CHAT_IN_DB);
        return result ? result.refID : undefined;
    } catch (error) {
        onError(error);
        return undefined;
    }
}

export const changeTemperatureInDb = async (temp: number, id: number, storage: indexedDBStorage) => {
    try {
        const db = await connectToDB(storage);
        const stored = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(id);
        if (stored) {
            stored.Options.temperature = temp;
            await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
        }
    } catch (error) {
        onError(error);
    }
};

export const changeSystempromptInDb = async (system: string, id: number, storage: indexedDBStorage) => {
    try {
        const db = await connectToDB(storage);
        const stored = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(id);
        if (stored) {
            stored.Options.system = system;
            await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
        }
    } catch (error) {
        onError(error);
    }
};

export const changeMaxTokensInDb = async (tokens: number, id: number, storage: indexedDBStorage) => {
    try {
        const db = await connectToDB(storage);
        const stored = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(id);
        if (stored) {
            stored.Options.maxTokens = tokens;
            await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
        }
    } catch (error) {
        onError(error);
    }
};

// History functions
export async function renameChat(storage: indexedDBStorage, newName: string, chat: any) {
    try {
        const db = await connectToDB(storage);
        chat.Data.Name = newName;
        await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(chat);
    } catch (error) {
        onError(error);
    }
}

export const changeFavouritesInDb = async (fav: boolean, id: number, storage: indexedDBStorage) => {
    try {
        const db = await connectToDB(storage);
        const stored = await db.transaction(storage.objectStore_name).objectStore(storage.objectStore_name).get(id);
        if (stored) {
            stored.Options.favourites = fav;
            await db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(stored);
        }
    } catch (error) {
        onError(error);
    }
};

// Bot functions

export async function storeBot(bot: Bot) {
    try {
        const db = await connectToDB(bot_storage);
        await db.transaction(bot_storage.objectStore_name, "readwrite").objectStore(bot_storage.objectStore_name).put(bot);
    } catch (error) {
        onError(error);
    }
}

export async function getAllBots(): Promise<Bot[]> {
    try {
        const db = await connectToDB(bot_storage);
        const bots = await db.transaction(bot_storage.objectStore_name).objectStore(bot_storage.objectStore_name).getAll();
        return bots;
    } catch (error) {
        onError(error);
        return [];
    }
}

export async function getBotWithId(id: number): Promise<Bot | undefined> {
    try {
        const db = await connectToDB(bot_storage);
        const bot = await db.transaction(bot_storage.objectStore_name).objectStore(bot_storage.objectStore_name).get(id);
        return bot;
    } catch (error) {
        onError(error);
        return undefined;
    }
}

export async function deleteBotWithId(id: number) {
    try {
        const bot_db = await connectToDB(bot_storage);
        await bot_db.transaction(bot_storage.objectStore_name, "readwrite").objectStore(bot_storage.objectStore_name).delete(id);

        const bot_history_db = await connectToDB(bot_history_storage);
        await bot_history_db.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name).delete(id);
    } catch (error) {
        onError(error);
    }
}

export async function getBotName(id: number): Promise<[number, string]> {
    const bot = await getBotWithId(id);
    return bot ? [bot.id, bot.title] : [0, ""];
}

export async function saveBotChatToDB(a: any[], id: number) {
    try {
        const bot_history_db = await connectToDB(bot_history_storage);
        const stored = await bot_history_db.transaction(bot_history_storage.objectStore_name).objectStore(bot_history_storage.objectStore_name).get(id);
        let data;
        if (stored) {
            // if the chat already exists in the DB
            let storedAnswers = stored.Answers;
            if (storedAnswers.length > 0 && storedAnswers[storedAnswers.length - 1][1].answer == "") {
                storedAnswers[storedAnswers.length - 1][1] = a[1];
            } else {
                storedAnswers.push(a);
            }
            data = stored;
        } else {
            // if the chat does not exist in the DB
            data = {
                Answers: [a],
                id: id
            };
        }
        await bot_history_db.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name).put(data);
    } catch (error) {
        onError(error);
    }
}

export async function popLastBotMessageInDB(id: number) {
    try {
        const bot_history_db = await connectToDB(bot_history_storage);
        const chat = bot_history_db.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name);
        const stored = await chat.get(id);
        if (stored) {
            await chat.delete(id);
            stored.Answers.pop();
            await chat.put(stored);
        }
    } catch (error) {
        onError(error);
    }
}
