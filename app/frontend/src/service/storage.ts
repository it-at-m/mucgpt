import { MutableRefObject } from "react";

import { chatApi, handleRedirect } from "../api/api";
import { Bot, ChatRequest, ChatTurn } from "../api/models";

export interface indexedDBStorage {
    db_name: string;
    db_version: number;
    objectStore_name: string;
}
export const CURRENT_CHAT_IN_DB = 0;

export async function onUpgrade(openRequest: IDBOpenDBRequest, storage: indexedDBStorage) {
    let db = openRequest.result;
    let transaction = openRequest.transaction;
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
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let stored = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).get(current_id);

        stored.onsuccess = async () => {
            let data;
            let dataID;
            let result = stored.result;
            if (result) {
                // if the chat allready exist in the DB
                dataID = result.id;
                let storedAnswers = result.Data.Answers;
                if (storedAnswers.length > 0 && storedAnswers[storedAnswers.length - 1][1].answer == "") {
                    storedAnswers[storedAnswers.length - 1][1] = a[1];
                } else {
                    storedAnswers.push(a);
                }
                result.Data.LastEdited = Date.now();
                if (storage.objectStore_name === "chat") {
                    result.Options.system = system_message;
                    result.Options.maxTokens = max_output_tokens;
                    result.Options.temperature = temperature;
                }
                data = result;
            } else {
                // if the chat does not exist in the DB
                let name: string = "";
                let new_idcounter = id_counter;
                if (language != undefined && temperature != undefined && system_message != undefined && max_output_tokens != undefined && model != undefined) {
                    name = await (await getChatName(a, language, temperature, system_message, max_output_tokens, model)).content;
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
            let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
            let request = chat.put(data);
            request.onerror = () => onError(request);
            data["id"] = CURRENT_CHAT_IN_DB;
            data["refID"] = dataID;
            request = chat.put(data);
            request.onerror = () => onError(request);
        };
    };
}

export async function getChatName(answers: any, language: string, temperature: number, system_message: string, max_output_tokens: number, model: string) {
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

export async function renameChat(storage: indexedDBStorage, newName: string, chat: any) {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        chat.Data.Name = newName;
        let getRequest = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).put(chat);
        getRequest.onerror = () => onError(getRequest);
    };
}

export async function getStartDataFromDB(storage: indexedDBStorage, id: number): Promise<any> {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    let promise = new Promise(resolve => {
        openRequest.onsuccess = function () {
            let getRequest = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).get(id);
            getRequest.onsuccess = function () {
                let res = undefined;
                if (getRequest.result) {
                    res = getRequest.result;
                }
                resolve(res);
            };
            getRequest.onerror = () => onError(getRequest);
        };
    });
    return await promise;
}

export async function deleteChatFromDB(
    storage: indexedDBStorage,
    id: number,
    setAnswers: (answers: []) => void,
    isCurrent: boolean,
    lastQuestionRef: MutableRefObject<string>
) {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    if (isCurrent) {
        setAnswers([]);
        lastQuestionRef.current = "";
    }
    openRequest.onsuccess = async function () {
        openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(id);
        if (isCurrent && id != CURRENT_CHAT_IN_DB) {
            openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(CURRENT_CHAT_IN_DB);
        }
    };
}

export function popLastMessageInDB(storage: indexedDBStorage, id: number) {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            let deleted = chat.delete(id);
            deleted.onsuccess = function () {
                if (stored.result) {
                    stored.result.Data.Answers.pop();
                    let put = chat.put(stored.result);
                    put.onerror = () => onError(put);
                }
            };
            deleted.onerror = () => onError(deleted);
        };
        stored.onerror = () => onError(stored);
    };
}

export function getHighestKeyInDB(storage: indexedDBStorage): Promise<number> {
    return new Promise((resolve, reject) => {
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest);
        openRequest.onsuccess = function () {
            let keys = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).getAllKeys();
            keys.onsuccess = function () {
                let highestKey = Math.max(...keys.result.map(Number), 0);
                resolve(highestKey);
            };
            keys.onerror = () => reject(keys.error);
        };
    });
}

export function getCurrentChatID(storage: indexedDBStorage): Promise<number | undefined> {
    // This method returns the current chat ID or undefined if there is currently no chat in the chat window
    return new Promise((resolve, reject) => {
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest);
        openRequest.onsuccess = function () {
            let getRequest = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).get(CURRENT_CHAT_IN_DB);
            getRequest.onsuccess = function () {
                let res = undefined;
                if (getRequest.result) {
                    res = getRequest.result.refID;
                }
                resolve(res);
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}

export const changeTemperatureInDb = (temp: number, id: number, storage: indexedDBStorage) => {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            if (stored.result) {
                stored.result.Options.temperature = temp;
                chat.put(stored.result);
            }
        };
    };
};

export const changeSystempromptInDb = (system: string, id: number, storage: indexedDBStorage) => {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            if (stored.result) {
                stored.result.Options.system = system;
                chat.put(stored.result);
            }
        };
    };
};

export const changeMaxTokensInDb = (tokens: number, id: number, storage: indexedDBStorage) => {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            if (stored.result) {
                stored.result.Options.maxTokens = tokens;
                chat.put(stored.result);
            }
        };
    };
};

export const changeFavouritesInDb = (fav: boolean, id: number, storage: indexedDBStorage) => {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            if (stored.result) {
                stored.result.Options.favourites = fav;
                chat.put(stored.result);
            }
        };
        stored.onerror = () => onError(stored);
    };
};

export function checkStructurOfDB(storage: indexedDBStorage) {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    let storeName = storage.objectStore_name;
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
        }
    };
}

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

export async function storeBot(bot: Bot) {
    let openRequest = indexedDB.open(bot_storage.db_name, bot_storage.db_version);
    let storeName = bot_storage.objectStore_name;
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
        }
        openRequest.result.transaction(bot_storage.objectStore_name, "readwrite").objectStore(bot_storage.objectStore_name).put(bot);
    };
}

export async function getAllBots() {
    return new Promise<Bot[]>((resolve, reject) => {
        let openRequest = indexedDB.open(bot_storage.db_name, bot_storage.db_version);
        let storeName = bot_storage.objectStore_name;
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_storage);
        openRequest.onerror = () => onError(openRequest);
        openRequest.onsuccess = async function () {
            let db = openRequest.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
            let getRequest = openRequest.result.transaction(bot_storage.objectStore_name, "readonly").objectStore(bot_storage.objectStore_name).getAll();
            getRequest.onsuccess = function () {
                resolve(getRequest.result);
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}

export async function getBotWithId(id: number) {
    let openRequest = indexedDB.open(bot_storage.db_name, bot_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_storage);
    openRequest.onerror = () => onError(openRequest);
    let promise = new Promise<Bot>(resolve => {
        openRequest.onsuccess = function () {
            let getRequest = openRequest.result.transaction(bot_storage.objectStore_name, "readonly").objectStore(bot_storage.objectStore_name).get(id);
            getRequest.onsuccess = function () {
                let res = undefined;
                if (getRequest.result) {
                    res = getRequest.result;
                }
                resolve(res);
            };
            getRequest.onerror = () => onError(getRequest);
        };
    });
    return await promise;
}

export async function deleteBotWithId(id: number) {
    let openRequest = indexedDB.open(bot_storage.db_name, bot_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        openRequest.result.transaction(bot_storage.objectStore_name, "readwrite").objectStore(bot_storage.objectStore_name).delete(id);
    };
    let openRequest2 = indexedDB.open(bot_history_storage.db_name, bot_history_storage.db_version);
    openRequest2.onupgradeneeded = () => onUpgrade(openRequest2, bot_history_storage);
    openRequest2.onerror = () => onError(openRequest2);
    openRequest2.onsuccess = function () {
        openRequest2.result.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name).delete(id);
    };
}

export async function getBotName(id: number): Promise<[number, string]> {
    const bot = await getBotWithId(id);
    return bot ? [bot.id, bot.title] : [0, ""];
}

export async function saveBotChatToDB(a: any[], id: number) {
    let openRequest = indexedDB.open(bot_history_storage.db_name, bot_history_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_history_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let stored = openRequest.result.transaction(bot_history_storage.objectStore_name, "readonly").objectStore(bot_history_storage.objectStore_name).get(id);
        stored.onsuccess = async () => {
            let data;
            let result = stored.result;
            if (result) {
                // if the chat allready exist in the DB
                let storedAnswers = result.Answers;
                if (storedAnswers.length > 0 && storedAnswers[storedAnswers.length - 1][1].answer == "") {
                    storedAnswers[storedAnswers.length - 1][1] = a[1];
                } else {
                    storedAnswers.push(a);
                }
                data = result;
            } else {
                // if the chat does not exist in the DB
                let name: string = "";
                data = {
                    Answers: [a],
                    id: id
                };
            }
            let chat = openRequest.result.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name);
            let request = chat.put(data);
            request.onerror = () => onError(request);
        };
    };
}

export function popLastBotMessageInDB(id: number) {
    let openRequest = indexedDB.open(bot_history_storage.db_name, bot_history_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_history_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let chat = openRequest.result.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name);
        let stored = chat.get(id);
        stored.onsuccess = function () {
            let deleted = chat.delete(id);
            deleted.onsuccess = function () {
                if (stored.result) {
                    stored.result.Answers.pop();
                    let put = chat.put(stored.result);
                    put.onerror = () => onError(put);
                }
            };
            deleted.onerror = () => onError(deleted);
        };
        stored.onerror = () => onError(stored);
    };
}
