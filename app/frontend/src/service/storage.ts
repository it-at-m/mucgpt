import { openDB, IDBPDatabase, IDBPTransaction } from "idb";

import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";

export interface DBObject<M, C> {
    _last_edited?: number;
    id?: string;
    messages: DBMessage<M>[];
    config: C;
}

export interface LegacDbObject {
    id?: string;
    Data: { Answers: [string, string]; LastEdited: number };
}

export interface DBMessage<R> {
    user: string;
    response: R;
}

export class StorageService<M, C> {
    config: IndexedDBStorage;
    constructor(config: IndexedDBStorage) {
        this.config = config;
    }

    async connectToDB(): Promise<IDBPDatabase<DBObject<M, C>>> {
        return openDB<DBObject<M, C>>(this.config.db_name, this.config.db_version, {
            upgrade: (db, _oldVersion, _newVersion, transaction) => {
                this.onUpgrade(db, transaction);
            }
        });
    }
    async onUpgrade(db: IDBPDatabase<DBObject<M, C>>, transaction: IDBPTransaction<DBObject<M, C>, string, "versionchange">) {
        let storeName = this.config.objectStore_name;
        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
        } else if (transaction) {
            transaction.objectStore(storeName).clear();
        }
    }

    onError(request: any) {
        console.error("Error", request.error);
    }

    async create(messages?: DBMessage<M>[], configuration?: C, id = uuid()): Promise<string | undefined> {
        try {
            const db_object: DBObject<M, C> = {
                messages: messages ? messages : [],
                config: configuration ? configuration : ({} as C),
                _last_edited: Date.now(),
                id: id
            };
            const db = await this.connectToDB();
            await db.add(this.config.objectStore_name, db_object);
            return db_object.id;
        } catch (error) {
            this.onError(error);
        }
    }

    async get(id: string): Promise<DBObject<M, C> | undefined> {
        try {
            const db = await this.connectToDB();
            const result = (await db.get(this.config.objectStore_name, id)) as DBObject<M, C>;
            return result;
        } catch (error) {
            this.onError(error);
        }
    }

    async getAll() {
        try {
            const db = await this.connectToDB();
            const result = (await db.getAll(this.config.objectStore_name)) as DBObject<M, C>[];
            return result;
        } catch (error) {
            this.onError(error);
        }
    }

    async update(id: string, messages?: DBMessage<M>[], configuration?: C) {
        try {
            const db = await this.connectToDB();
            const stored = await this.get(id);
            if (stored) {
                stored.messages = messages ? messages : stored.messages;
                stored.config = configuration ? configuration : stored.config;
                stored._last_edited = Date.now();
                const result = await db.put(this.config.objectStore_name, stored);
                return stored;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async delete(id: string) {
        try {
            const db = await this.connectToDB();
            await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).delete(id);
        } catch (error) {
            this.onError(error);
        }
    }

    async setup() {
        try {
            const db = await this.connectToDB();
            const storeName = this.config.objectStore_name;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async getNewestChat() {
        try {
            const results = await this.getAll();
            if (results && results.length > 0) return results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
            else return undefined;
        } catch (error) {
            this.onError(error);
        }
    }

    async appendMessage(id: string, data: DBMessage<M>, configuration?: C) {
        try {
            const stored = await this.get(id);
            if (stored) {
                stored.messages.push(data);
                const updated = await this.update(id, stored.messages, configuration ? configuration : stored.config);
                return updated;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async popMessage(id: string) {
        try {
            const stored = await this.get(id);
            if (stored) {
                const popedMessage = stored.messages.pop();
                const updated = await this.update(id, stored.messages, stored.config);
                return popedMessage;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async rollbackMessage(id: string, message: string) {
        try {
            const stored = await this.get(id);
            if (stored) {
                while (stored.messages.length) {
                    let last = stored.messages.pop();
                    if (last && last.user == message) {
                        break;
                    }
                }
                const updated = await this.update(id, stored.messages, stored.config);
                return updated;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }
}

/**
export class HistoryStorageService extends StorageService {
    constructor(config: indexedDBStorage) {
        super(config);
    }

    async renameChat(newName: string, chat: any) {
        try {
            const db = await this.connectToDB();
            chat.Data.Name = newName;
            await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(chat);
        } catch (error) {
            this.onError(error);
        }
    }

    async changeFavouritesInDb(fav: boolean, id: number) {
        try {
            const db = await this.connectToDB();
            const stored = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
            if (stored) {
                stored.Options.favourites = fav;
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }
}
*/
