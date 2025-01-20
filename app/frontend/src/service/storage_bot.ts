import { MutableRefObject } from "react";
import { Bot, StoredCommunityBot } from "../api/models";
import { getCommunityBot } from "../api";

export interface indexedDBStorage {
    db_name: string;
    db_version: number;
    objectStore_name: string;
}

export async function onUpgrade(openRequest: IDBOpenDBRequest, storage: indexedDBStorage) {
    let db = openRequest.result;
    let transaction = openRequest.transaction;
    let storeName = storage.objectStore_name;
    if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
    } else if (transaction) {
        let store = transaction.objectStore(storeName);
        let getRequest = store.getAll();
        getRequest.onsuccess = function () {
            let data = getRequest.result;
            for (let i = 0; i < data.length; i++) {
                if (typeof data[i].id === "number") {
                    data[i].id = data[i].id.toString();
                }
            }
            let clearRequest = store.clear();
            clearRequest.onsuccess = function () {
                for (let i = 0; i < data.length; i++) {
                    store.put(data[i]);
                }
            };
            clearRequest.onerror = () => onError(clearRequest);
        };
    }
}

export async function onError(request: any) {
    console.error("Error", request.error);
}

export const bot_storage: indexedDBStorage = {
    db_name: "MUCGPT-BOTS",
    objectStore_name: "bots",
    db_version: 4
};
export const bot_history_storage: indexedDBStorage = {
    db_name: "MUCGPT-BOTS-HISTORY",
    objectStore_name: "bots-history",
    db_version: 4
};

export const community_bot_storage: indexedDBStorage = {
    db_name: "MUCGPT-COMMUNITY-BOTS",
    objectStore_name: "bots",
    db_version: 2
};
export const community_bot_history_storage: indexedDBStorage = {
    db_name: "MUCGPT-COMMUNITY-BOTS-HISTORY",
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

export async function storeCommunityBot(id: string, title: string) {
    let openRequest = indexedDB.open(community_bot_storage.db_name, community_bot_storage.db_version);
    let storeName = community_bot_storage.objectStore_name;
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = async function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
        }
        openRequest.result
            .transaction(community_bot_storage.objectStore_name, "readwrite")
            .objectStore(bot_storage.objectStore_name)
            .put({ id: id, title: title });
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

export async function getAllCommunityBots() {
    return new Promise<StoredCommunityBot[]>((resolve, reject) => {
        let openRequest = indexedDB.open(community_bot_storage.db_name, community_bot_storage.db_version);
        let storeName = community_bot_storage.objectStore_name;
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_storage);
        openRequest.onerror = () => onError(openRequest);
        openRequest.onsuccess = async function () {
            let db = openRequest.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
            let getRequest = openRequest.result
                .transaction(community_bot_storage.objectStore_name, "readonly")
                .objectStore(community_bot_storage.objectStore_name)
                .getAll();
            getRequest.onsuccess = function () {
                resolve(getRequest.result);
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}

export async function getBotWithId(id: string) {
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

export async function getCommunityBotWithId(id: string) {
    let openRequest = indexedDB.open(community_bot_storage.db_name, community_bot_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_storage);
    openRequest.onerror = () => onError(openRequest);
    let promise = new Promise<Bot>(resolve => {
        openRequest.onsuccess = function () {
            let getRequest = openRequest.result
                .transaction(community_bot_storage.objectStore_name, "readonly")
                .objectStore(community_bot_storage.objectStore_name)
                .get(id);
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

export async function deleteBotWithId(id: string) {
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

export async function deleteCommunityBotWithId(id: string) {
    let openRequest = indexedDB.open(community_bot_storage.db_name, community_bot_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        openRequest.result.transaction(community_bot_storage.objectStore_name, "readwrite").objectStore(community_bot_storage.objectStore_name).delete(id);
    };
    let openRequest2 = indexedDB.open(community_bot_history_storage.db_name, community_bot_history_storage.db_version);
    openRequest2.onupgradeneeded = () => onUpgrade(openRequest2, community_bot_history_storage);
    openRequest2.onerror = () => onError(openRequest2);
    openRequest2.onsuccess = function () {
        openRequest2.result
            .transaction(community_bot_history_storage.objectStore_name, "readwrite")
            .objectStore(community_bot_history_storage.objectStore_name)
            .delete(id);
    };
}

export async function getBotName(id: string): Promise<[string, string]> {
    const bot = await getBotWithId(id);
    return bot ? [bot.id, bot.title] : ["", ""];
}

export async function getCommunityBotName(id: string): Promise<[string, string]> {
    const bot = await getCommunityBot(id);
    return bot ? [bot.id, bot.title] : ["", ""];
}

export async function saveBotChatToDB(a: any[], id: string) {
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

export function changeBotChatIdInDB(oldId: string, newId: string) {
    let openRequest = indexedDB.open(bot_history_storage.db_name, bot_history_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, bot_history_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let chat = openRequest.result.transaction(bot_history_storage.objectStore_name, "readwrite").objectStore(bot_history_storage.objectStore_name);
        let stored = chat.get(oldId);
        stored.onsuccess = () => {
            let result = stored.result;
            let data;
            if (result) {
                data = result;
                data.id = newId;
                let request = chat.put(data);
                request.onerror = () => onError(request);
                request.onsuccess = () => {
                    chat.delete(oldId);
                };
            }
        };
    };
}

export async function saveCommunityBotChatToDB(a: any[], id: string) {
    let openRequest = indexedDB.open(community_bot_history_storage.db_name, community_bot_history_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_history_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let stored = openRequest.result
            .transaction(community_bot_history_storage.objectStore_name, "readonly")
            .objectStore(community_bot_history_storage.objectStore_name)
            .get(id);
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
            let chat = openRequest.result
                .transaction(community_bot_history_storage.objectStore_name, "readwrite")
                .objectStore(community_bot_history_storage.objectStore_name);
            let request = chat.put(data);
            request.onerror = () => onError(request);
        };
    };
}

export function popLastBotMessageInDB(id: string) {
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

export function popLastCommunityBotMessageInDB(id: string) {
    let openRequest = indexedDB.open(community_bot_history_storage.db_name, community_bot_history_storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, community_bot_history_storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let chat = openRequest.result
            .transaction(community_bot_history_storage.objectStore_name, "readwrite")
            .objectStore(community_bot_history_storage.objectStore_name);
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

export function copyHistory(oldID: string, newID: string, oldStorage: indexedDBStorage, newStorage: indexedDBStorage) {
    let openRequest = indexedDB.open(oldStorage.db_name, oldStorage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, oldStorage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let getRequest = openRequest.result.transaction(oldStorage.objectStore_name, "readonly").objectStore(oldStorage.objectStore_name).get(oldID);
        getRequest.onsuccess = function () {
            if (getRequest.result) {
                let res = getRequest.result;
                res.id = newID;
                let putRequest = indexedDB.open(newStorage.db_name, newStorage.db_version);
                putRequest.onupgradeneeded = () => onUpgrade(putRequest, newStorage);
                putRequest.onerror = () => onError(putRequest);
                putRequest.onsuccess = function () {
                    putRequest.result.transaction(newStorage.objectStore_name, "readwrite").objectStore(newStorage.objectStore_name).put(res);
                };
            }
            getRequest.onerror = () => onError(getRequest);
        };
    };
}

export async function getBotStartDataFromDB(storage: indexedDBStorage, id: string): Promise<any> {
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

export async function deleteBotChatFromDB(
    storage: indexedDBStorage,
    id: string,
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
    };
}
