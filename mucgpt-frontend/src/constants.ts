import { ApplicationConfig } from "./api";
import { IndexedDBStorage } from "./service/indexedDBStorage";

export const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

//APP Config
export const DEFAULT_APP_CONFIG: ApplicationConfig = {
    models: [
        {
            llm_name: "KICC GPT",
            max_input_tokens: 128000,
            max_output_tokens: 12000,
            description: "",
            speed: "",
            knowledge_cut_off: "",
            input_cost_per_token: 1,
            output_cost_per_token: 1,
            supports_function_calling: null,
            supports_reasoning: null,
            supports_vision: null,
            litellm_provider: null,
            inference_location: null
        },
        {
            llm_name: "Unknown GPT",
            max_input_tokens: 128000,
            max_output_tokens: 12000,
            description: "",
            speed: "",
            knowledge_cut_off: "",
            input_cost_per_token: 1,
            output_cost_per_token: 1,
            supports_function_calling: null,
            supports_reasoning: null,
            supports_vision: null,
            litellm_provider: null,
            inference_location: null
        },
        {
            llm_name: "AnnonymGPT",
            max_input_tokens: 128000,
            max_output_tokens: 128000,
            description: "",
            speed: "",
            knowledge_cut_off: "",
            input_cost_per_token: 1,
            output_cost_per_token: 1,
            supports_function_calling: null,
            supports_reasoning: null,
            supports_vision: null,
            litellm_provider: null,
            inference_location: null
        }
    ],
    env_name: "MUC tschibidi-C",
    alternative_logo: true,
    core_version: "DEV 1.0.0",
    frontend_version: "DEV 1.0.0",
    assistant_version: "DEV 1.0.0"
};

//IDB storage configs
export const ASSISTANT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-ASSISTANTS",
    objectStore_name: "bots",
    db_version: 1
};
//Old storage, used to migrate existing assistants
export const LEGACY_ASSISTANT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-BOTS",
    objectStore_name: "bots",
    db_version: 3
};

export const CHAT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-CHAT",
    objectStore_name: "chat",
    db_version: 3
};

export const COMMUNITY_ASSISTANT_STORE: IndexedDBStorage = {
    db_name: "MUCGPT-COMMUNITY-ASSISTANTS",
    objectStore_name: "assistants",
    db_version: 1
};

// Create Assistant examples
export const CREATE_ASSISTANT_EXAMPLE_1 = "Englischübersetzer: Der Assistent übersetzt den eingegebenen Text ins Englische.";
export const CREATE_ASSISTANT_EXAMPLE_2 =
    "Der Assistent ist ein Mitarbeiter der Stadt München und antwortet höflich sowie individuell auf die eingehenden E-Mails.";
export const CREATE_ASSISTANT_EXAMPLE_3 =
    "Der Assistent erstellt für das eingegebene Wort oder den eingegebenen Satz zehn verschiedene Umformulierungen oder Synonyme.";
