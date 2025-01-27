import { openDB, IDBPDatabase, IDBPTransaction } from "idb";

import { v4 as uuid } from "uuid";
import { IndexedDBStorage } from "./indexedDBStorage";

/**
 * Represents a database object that stores messages and configuration data.
 */
export interface DBObject<M, C> {
    _last_edited?: number;
    id?: string;
    name?: string;
    favorite?: boolean;
    messages: DBMessage<M>[];
    config: C;
}

export interface LegacDbObject {
    id?: string;
    Data: { Answers: [string, string]; LastEdited: number };
}
/**
 * Represents a message stored in the database.
 */
export interface DBMessage<R> {
    user: string; //the user message/query
    response: R; //the response from the ai
}

/**
 * Represents a storage service for managing data in an IndexedDB.
 *
 * The service provides methods for creating, reading, updating, and deleting records in the database.
 * Each record is saved in a object store and is from type DBObject.
 * @template M - The type of messages stored in the database.
 * @template C - The type of configuration stored in the database.
 */
export class StorageService<M, C> {
    config: IndexedDBStorage;
    private active_chat_id?: string;
    constructor(config: IndexedDBStorage, active_chat_id?: string) {
        this.config = config;
        this.active_chat_id = active_chat_id;
    }

    getActiveChatId() {
        return this.active_chat_id;
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

    /**
     * Creates a new entry in the database with the specified messages, configuration, and ID.
     * If messages or configuration are not provided, empty arrays and an empty object will be used, respectively.
     * If ID is not provided, a new UUID will be generated.
     *
     * @param messages - An optional array of messages to be stored in the database.
     * @param configuration - An optional configuration object to be stored in the database.
     * @param id - An optional ID for the new entry. If not provided, a new UUID will be generated.
     * @param name - An optional name for the new entry.
     * @param favorite - An optional boolean indicating whether the new entry should be marked as a favorite.
     * @returns A Promise that resolves to the ID of the newly created entry, or undefined if an error occurs.
     *
     */
    async create(messages?: DBMessage<M>[], configuration?: C, id = uuid(), name?: string, favorite: boolean = false): Promise<string | undefined> {
        try {
            const db_object: DBObject<M, C> = {
                messages: messages ? messages : [],
                config: configuration ? configuration : ({} as C),
                _last_edited: Date.now(),
                id: id,
                favorite: favorite,
                name: name
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

    async update(messages?: DBMessage<M>[], configuration?: C, alternative_id?: string, favorite?: boolean, name?: string) {
        try {
            const id = alternative_id ? alternative_id : this.getActiveChatId();
            if (!id) throw new Error("No active id found and alternative id not provided");
            const db = await this.connectToDB();
            const stored = await this.get(id);
            if (stored) {
                stored.messages = messages ? messages : stored.messages;
                stored.config = configuration ? configuration : stored.config;
                stored._last_edited = Date.now();
                if (favorite !== undefined) stored.favorite = favorite;
                if (name) stored.name = name;
                const result = await db.put(this.config.objectStore_name, stored);
                return stored;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * Deletes a record from the database.
     * If `alternative_id` is provided, it deletes the record with the specified ID.
     * Otherwise, it deletes the record with the active chat ID.
     *
     * @param alternative_id - The ID of the record to delete (optional).
     */
    async delete(alternative_id?: string) {
        try {
            const id = alternative_id ? alternative_id : this.getActiveChatId();
            if (id) {
                const db = await this.connectToDB();
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).delete(id);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * Retrieves the newest chat from the storage.
     * @returns The newest chat object, or undefined if no chats are available.
     */
    async getNewestChat() {
        try {
            const results = await this.getAll();
            if (results && results.length > 0) {
                const newest_chat = results.toSorted((a, b) => (b._last_edited as number) - (a._last_edited as number))[0];
                return newest_chat;
            } else return undefined;
        } catch (error) {
            this.onError(error);
        }
    }

    async appendMessage(data: DBMessage<M>, configuration?: C) {
        try {
            const id = this.getActiveChatId() as string;
            const stored = await this.get(id);
            if (stored) {
                stored.messages.push(data);
                const updated = await this.update(stored.messages, configuration ? configuration : stored.config);
                return updated;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async popMessage() {
        try {
            const id = this.getActiveChatId();
            if (!id) throw new Error("No active id found");
            const stored = await this.get(id);
            if (stored) {
                const popedMessage = stored.messages.pop();
                const updated = await this.update(stored.messages, stored.config);
                return popedMessage;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async rollbackMessage(message: string) {
        try {
            const id = this.getActiveChatId();
            if (!id) throw new Error("No active id found");
            const stored = await this.get(id);
            if (stored) {
                while (stored.messages.length) {
                    let last = stored.messages.pop();
                    if (last && last.user == message) {
                        break;
                    }
                }
                const updated = await this.update(stored.messages, stored.config);
                return updated;
            } else throw new Error("No object with id " + id + " found");
        } catch (error) {
            this.onError(error);
        }
    }

    async renameChat(id: string, newName: string) {
        try {
            return await this.update(undefined, undefined, id, undefined, newName);
        } catch (error) {
            this.onError(error);
        }
    }

    async changeFavouritesInDb(id: string, fav: boolean) {
        try {
            return await this.update(undefined, undefined, id, fav, undefined);
        } catch (error) {
            this.onError(error);
        }
    }
}
