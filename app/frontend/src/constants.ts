import { ApplicationConfig } from "./api";
import { IndexedDBStorage } from "./service/indexedDBStorage";

export const DEFAULT_APP_CONFIG: ApplicationConfig = {
    models: [
        {
            llm_name: "KICC GPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: ""
        },
        {
            llm_name: "Unknown GPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: ""
        }
    ],
    frontend: {
        labels: {
            env_name: "MUC tschibidi-C"
        },
        alternative_logo: true,
        enable_simply: true
    },
    version: "DEV 1.0.0",
    commit: "152b175"
};

export const BOT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-BOTS",
    objectStore_name: "bots",
    db_version: 3
};
export const BOT_HISTORY_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-BOTS-HISTORY",
    objectStore_name: "bots-history",
    db_version: 2
};

export const SUMMARIZE_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-SUMMARIZE",
    objectStore_name: "summarize",
    db_version: 2
};

export const SIMPLY_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-SIMPLY",
    objectStore_name: "simply",
    db_version: 2
};

export const BRAINSTORM_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-BRAINSTORMING",
    objectStore_name: "brainstorming",
    db_version: 2
};

export const CHAT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-CHAT",
    objectStore_name: "chat",
    db_version: 2
};

export const enum STORAGE_KEYS {
    CHAT_TEMPERATURE = "CHAT_TEMPERATURE",
    CHAT_SYSTEM_PROMPT = "CHAT_SYSTEM_PROMPT",
    CHAT_MAX_TOKENS = "CHAT_MAX_TOKENS"
}

export const CREATE_BOT_EXAMPLE_1 = "Englischübersetzer: Der Assistent übersetzt den eingegebenen Text ins Englische.";
export const CREATE_BOT_EXAMPLE_2 = "Der Assistent ist ein Mitarbeiter der Stadt München und antwortet höflich sowie individuell auf die eingehenden E-Mails.";
export const CREATE_BOT_EXAMPLE_3 =
    "Der Assistent erstellt für das eingegebene Wort oder den eingegebenen Satz zehn verschiedene Umformulierungen oder Synonyme.";
