import { MutableRefObject } from "react";
import { chatApi, handleRedirect } from "../api/api";
import { ChatRequest, ChatTurn } from "../api/models";

export interface indexedDBStorage {
    db_name: string;
    db_version: number;
    objectStore_name: string;
}

export async function onUpgrade(openRequest: IDBOpenDBRequest, storage: indexedDBStorage) {
    let db = openRequest.result;
    if (!db.objectStoreNames.contains(storage.objectStore_name)) {
        db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
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
    max_tokens?: number
) {
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    openRequest.onsuccess = function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let stored = chat.get(current_id);

        stored.onsuccess = async () => {
            let data;
            let dataID;
            if (stored.result) {
                dataID = stored.result.id;
                stored.result.Data.Answers.push(a);
                stored.result.Data.LastEdited = Date.now();
                data = stored.result;
            } else {
                let name: string = "";
                if (language != undefined && temperature != undefined && system_message != undefined && max_tokens != undefined) {
                    name = await (await getChatName(a, language, temperature, system_message, max_tokens)).content;
                    name = name.replace('"', "");
                }
                let new_idcounter = id_counter;
                if (storage.objectStore_name === "chat") {
                    new_idcounter = new_idcounter + 1;
                    setIdCounter(new_idcounter);
                }
                setCurrentId(new_idcounter);
                data = { Data: { Answers: [a], Name: name, LastEdited: Date.now() }, id: new_idcounter };
                dataID = new_idcounter;
            }
            chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
            let request = chat.put(data);
            request.onerror = () => onError(request);
            data["id"] = 0;
            data["refID"] = dataID;
            request = chat.put(data);
            request.onerror = () => onError(request);
        };
    };
}

export async function getChatName(answers: any, language: string, temperature: number, system_message: string, max_tokens: number) {
    const history: ChatTurn[] = [{ user: answers[0], bot: answers[1].answer }];
    const request: ChatRequest = {
        history: [
            ...history,
            {
                user: "Gebe dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen, bestehend aus maximal 5 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Überprüfe dich selbst, ob der Name tatsächlich passend ist. Antworte nur mit dem vollständigen Namen und keinem weiteren Text. ",
                bot: undefined
            }
        ],
        shouldStream: false,
        language: language,
        temperature: temperature,
        system_message: system_message,
        max_tokens: max_tokens
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
    let openRequest = indexedDB.open(storage.db_name, storage.db_version);
    openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
    openRequest.onerror = () => onError(openRequest);
    let promise = new Promise(resolve => {
        openRequest.onsuccess = function () {
            let getRequest = openRequest.result.transaction(storage.objectStore_name, "readonly").objectStore(storage.objectStore_name).get(id);
            getRequest.onsuccess = function () {
                if (getRequest.result) {
                    resolve(getRequest.result.Data.Answers);
                } else {
                    resolve(undefined);
                }
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
        if (isCurrent && id != 0) {
            openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(0);
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
            let db = openRequest.result;
            let transaction = db.transaction(storage.objectStore_name, "readwrite");
            let chat = transaction.objectStore(storage.objectStore_name);
            let keys = chat.getAllKeys();
            keys.onsuccess = function () {
                let result = keys.result;
                let highestKey = Math.max(...result.map(Number), 0);
                resolve(highestKey);
            };
            keys.onerror = () => reject(keys.error);
        };
    });
}

export function getZeroChat(storage: indexedDBStorage): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
        let openRequest = indexedDB.open(storage.db_name, storage.db_version);
        openRequest.onupgradeneeded = () => onUpgrade(openRequest, storage);
        openRequest.onerror = () => onError(openRequest);
        openRequest.onsuccess = function () {
            let db = openRequest.result;
            let transaction = db.transaction(storage.objectStore_name, "readwrite");
            let chat = transaction.objectStore(storage.objectStore_name);
            let getRequest = chat.get(0);
            getRequest.onsuccess = function () {
                if (getRequest.result) {
                    resolve(getRequest.result.refID);
                } else {
                    resolve(undefined);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
    });
}
