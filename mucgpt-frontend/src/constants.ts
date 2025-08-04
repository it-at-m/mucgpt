import { ApplicationConfig } from "./api";
import { IndexedDBStorage } from "./service/indexedDBStorage";

//APP Config
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

//IDB storage configs
export const BOT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-ASSISTANTS",
    objectStore_name: "bots",
    db_version: 1
};
//Old storage, used to migrate existing bots
export const LEGACY_BOT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-BOTS",
    objectStore_name: "bots",
    db_version: 3
};

export const CHAT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-CHAT",
    objectStore_name: "chat",
    db_version: 3
};

// Create Bot examples
export const CREATE_BOT_EXAMPLE_1 = "Englischübersetzer: Der Assistent übersetzt den eingegebenen Text ins Englische.";
export const CREATE_BOT_EXAMPLE_2 = "Der Assistent ist ein Mitarbeiter der Stadt München und antwortet höflich sowie individuell auf die eingehenden E-Mails.";
export const CREATE_BOT_EXAMPLE_3 =
    "Der Assistent erstellt für das eingegebene Wort oder den eingegebenen Satz zehn verschiedene Umformulierungen oder Synonyme.";
