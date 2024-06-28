export interface indexedDBStorage {
    db_name: string;
    objectStore_name: string;
}

const VERSION = 1;
const ID = 1;

export async function saveToDB(a: any[], storage: indexedDBStorage) {
    let openRequest = indexedDB.open(storage.db_name, VERSION);

    openRequest.onupgradeneeded = function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storage.objectStore_name)) {
            db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
        }
    };

    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };

    openRequest.onsuccess = function () {
        let db = openRequest.result;
        let transaction = db.transaction(storage.objectStore_name, "readwrite");
        let chat = transaction.objectStore(storage.objectStore_name);
        let stored = chat.get(ID);
        stored.onsuccess = () => {
            let request: IDBRequest;

            if (stored.result) {
                stored.result.Answers.push(a);
                request = chat.put({ Answers: stored.result.Answers, id: ID });
            } else {
                request = chat.put({ Answers: [a], id: ID });
            }
            request.onerror = function () {
                console.log("Error", request.error);
            };
        };
    };
}

export async function getStartDataFromDB(storage: indexedDBStorage): Promise<any> {
    let openRequest = indexedDB.open(storage.db_name, VERSION);
    let db;
    openRequest.onupgradeneeded = function () {
        db = openRequest.result;
        if (!db.objectStoreNames.contains(storage.objectStore_name)) {
            db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
        }
    };
    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };

    let promise = new Promise(resolve => {
        openRequest.onsuccess = async function () {
            db = openRequest.result;
            let old = db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).get(ID);
            old.onsuccess = async () => {
                if (await old.result) {
                    resolve(await old.result.Answers);
                } else {
                    resolve(undefined);
                }
            };
        };
    });

    return await promise;
}

export async function clearDB(storage: indexedDBStorage) {
    let openRequest = indexedDB.open(storage.db_name, VERSION);
    let db;
    openRequest.onupgradeneeded = function () {
        db = openRequest.result;
        if (!db.objectStoreNames.contains(storage.objectStore_name)) {
            db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
        }
    };

    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };

    openRequest.onsuccess = async function () {
        db = openRequest.result;
        db.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name).delete(ID);
    };
}

export function popLastInDB(storage: indexedDBStorage) {
    let openRequest = indexedDB.open(storage.db_name, VERSION);
    openRequest.onupgradeneeded = function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storage.objectStore_name)) {
            db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
        }
    };
    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };
    openRequest.onsuccess = function () {
        let db = openRequest.result;
        let transaction = db.transaction(storage.objectStore_name, "readwrite");
        let chat = transaction.objectStore(storage.objectStore_name);
        let stored = chat.get(ID);
        stored.onsuccess = function () {
            let deleted = chat.delete(ID);
            deleted.onsuccess = function () {
                if (stored.result) {
                    stored.result.Answers.pop();
                    let put = chat.put({ Answers: stored.result.Answers, id: ID });
                    put.onerror = function () {
                        console.error("Error", put.error);
                    };
                }
            };
            deleted.onerror = function () {
                console.error("Error", deleted.error);
            };
        };
        stored.onerror = function () {
            console.error("Error", stored.error);
        };
    };
}

export function deleteFromDB(storage: indexedDBStorage) {
    let openRequest = indexedDB.open(storage.db_name, VERSION);
    openRequest.onupgradeneeded = function () {
        let db = openRequest.result;
        if (!db.objectStoreNames.contains(storage.objectStore_name)) {
            db.createObjectStore(storage.objectStore_name, { keyPath: "id" });
        }
    };
    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };
    openRequest.onsuccess = function () {
        let chat = openRequest.result.transaction(storage.objectStore_name, "readwrite").objectStore(storage.objectStore_name);
        let deleted = chat.delete(ID);
        deleted.onerror = function () {
            console.error("Error", deleted.error);
        };
    };
}
