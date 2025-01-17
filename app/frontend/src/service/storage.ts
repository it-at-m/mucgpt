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

export class StorageService {
    config: indexedDBStorage;
    constructor(config: indexedDBStorage) {
        this.config = config;
    }

    async connectToDB(alternativeDB?: indexedDBStorage): Promise<IDBPDatabase> {
        if (alternativeDB) {
            return await openDB(alternativeDB.db_name, alternativeDB.db_version, {
                upgrade: (db, _oldVersion, _newVersion, transaction) => {
                    this.onUpgrade(db, transaction);
                }
            });
        }
        return await openDB(this.config.db_name, this.config.db_version, {
            upgrade: (db, _oldVersion, _newVersion, transaction) => {
                this.onUpgrade(db, transaction);
            }
        });
    }
    async onUpgrade(db: IDBPDatabase, transaction: IDBPTransaction<unknown, string[], "versionchange">) {
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

    async saveToDB(
        a: any[],
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
            const db = await this.connectToDB();
            const stored = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(current_id);

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
                if (this.config.objectStore_name === "chat") {
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
                    name = await (await this._getChatName(a, language, temperature, system_message, max_output_tokens, model)).content;
                    name = name.replaceAll('"', "").replaceAll(".", "");
                }
                if (this.config.objectStore_name === "chat") {
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
            const chat = db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name);
            await chat.put(data);
            data["id"] = CURRENT_CHAT_IN_DB;
            data["refID"] = dataID;
            await chat.put(data);
        } catch (error) {
            this.onError(error);
        }
    }

    async _getChatName(answers: any, language: string, temperature: number, system_message: string, max_output_tokens: number, model: string) {
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

    async getStartDataFromDB(id: number): Promise<any> {
        try {
            const db = await this.connectToDB();
            const result = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
            return result;
        } catch (error) {
            this.onError(error);
        }
    }

    async deleteChatFromDB(id: number, setAnswers: (answers: []) => void, isCurrent: boolean, lastQuestionRef: MutableRefObject<string>) {
        try {
            const db = await this.connectToDB();
            if (isCurrent) {
                setAnswers([]);
                lastQuestionRef.current = "";
            }
            await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).delete(id);
            if (isCurrent && id != CURRENT_CHAT_IN_DB) {
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).delete(CURRENT_CHAT_IN_DB);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async checkStructurOfDB() {
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

    async getHighestKeyInDB(): Promise<number> {
        try {
            const db = await this.connectToDB();
            const keys = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).getAllKeys();
            const highestKey = Math.max(...keys.map(Number), 0);
            return highestKey;
        } catch (error) {
            this.onError(error);
            return 0;
        }
    }
}

export class ChatStorageService extends StorageService {
    constructor(config: indexedDBStorage) {
        super(config);
    }

    async popLastMessageInDB(id: number) {
        try {
            const db = await this.connectToDB();
            const chat = db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name);
            const stored = await chat.get(id);
            if (stored) {
                await chat.delete(id);
                stored.Data.Answers.pop();
                await chat.put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async getCurrentChatID(): Promise<number | undefined> {
        try {
            const db = await this.connectToDB();
            const result = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(CURRENT_CHAT_IN_DB);
            return result ? result.refID : undefined;
        } catch (error) {
            this.onError(error);
            return undefined;
        }
    }

    async changeTemperatureInDb(temp: number, id: number) {
        try {
            const db = await this.connectToDB();
            const stored = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
            if (stored) {
                stored.Options.temperature = temp;
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async changeSystempromptInDb(system: string, id: number) {
        try {
            const db = await this.connectToDB();
            const stored = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
            if (stored) {
                stored.Options.system = system;
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async changeMaxTokensInDb(tokens: number, id: number) {
        try {
            const db = await this.connectToDB();
            const stored = await db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
            if (stored) {
                stored.Options.maxTokens = tokens;
                await db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }
}

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

export class BotStorageService extends StorageService {
    bot_config: indexedDBStorage;

    constructor(config: indexedDBStorage, bot_config: indexedDBStorage) {
        super(config);
        this.bot_config = bot_config;
    }

    async storeBot(bot: Bot) {
        try {
            const bot_db = await this.connectToDB(this.bot_config);
            await bot_db.transaction(this.bot_config.objectStore_name, "readwrite").objectStore(this.bot_config.objectStore_name).put(bot);
        } catch (error) {
            this.onError(error);
        }
    }

    async getAllBots(): Promise<Bot[]> {
        try {
            const bot_db = await this.connectToDB(this.bot_config);
            const bots = await bot_db.transaction(this.bot_config.objectStore_name).objectStore(this.bot_config.objectStore_name).getAll();
            return bots;
        } catch (error) {
            this.onError(error);
            return [];
        }
    }

    async getBotWithId(id: number): Promise<Bot | undefined> {
        try {
            const bot_db = await this.connectToDB(this.bot_config);
            const bot = await bot_db.transaction(this.bot_config.objectStore_name).objectStore(this.bot_config.objectStore_name).get(id);
            return bot;
        } catch (error) {
            this.onError(error);
            return undefined;
        }
    }

    async deleteBotWithId(id: number) {
        try {
            const bot_db = await this.connectToDB(this.bot_config);
            await bot_db.transaction(this.bot_config.objectStore_name, "readwrite").objectStore(this.bot_config.objectStore_name).delete(id);

            const bot_history_db = await this.connectToDB();
            await bot_history_db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).delete(id);
        } catch (error) {
            this.onError(error);
        }
    }

    async getBotName(id: number): Promise<[number, string]> {
        const bot = await this.getBotWithId(id);
        return bot ? [bot.id, bot.title] : [0, ""];
    }

    async saveBotChatToDB(a: any[], id: number) {
        try {
            const bot_history_db = await this.connectToDB();
            const stored = await bot_history_db.transaction(this.config.objectStore_name).objectStore(this.config.objectStore_name).get(id);
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
            await bot_history_db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name).put(data);
        } catch (error) {
            this.onError(error);
        }
    }

    async popLastBotMessageInDB(id: number) {
        try {
            const bot_history_db = await this.connectToDB();
            const chat = bot_history_db.transaction(this.config.objectStore_name, "readwrite").objectStore(this.config.objectStore_name);
            const stored = await chat.get(id);
            if (stored) {
                await chat.delete(id);
                stored.Answers.pop();
                await chat.put(stored);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    async getHighestBotKey(): Promise<number> {
        try {
            const db = await this.connectToDB(this.bot_config);
            const keys = await db.transaction(this.bot_config.objectStore_name).objectStore(this.bot_config.objectStore_name).getAllKeys();
            const highestKey = Math.max(...keys.map(Number), 0);
            return highestKey;
        } catch (error) {
            this.onError(error);
            return 0;
        }
    }
}
