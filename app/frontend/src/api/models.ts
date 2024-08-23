export type AskResponse = {
    answer: string;
    error?: string;
    tokens?: number;
};

export type SumResponse = {
    answer: string[];
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: string;
};

export type ChatRequest = {
    history: ChatTurn[];
    temperature?: number;
    language?: string;
    max_tokens?: number;
    system_message?: string;
    shouldStream?: boolean;
    model?: string;
};

export type SumRequest = {
    text: string;
    detaillevel?: "short" | "medium" | "long";
    temperature?: number;
    language?: string;
};
export type BrainstormRequest = {
    topic: string;
    model: Model;
    temperature?: number;
    language?: string;
};

export interface ApplicationConfig {
    models: Model[];
    frontend: Frontend;
    version: string;
}

export interface Frontend {
    alternative_logo: boolean;
    labels: Labels;
}

export interface Model {
    max_tokens: number;
    model_name: string;
}

export interface Labels {
    env_name: string;
}

export interface Chunk {
    type: "E" | "C" | "I"; //ERROR, CONTENT, INFO
    message: string | ChunkInfo;
    order: number;
}

export interface ChunkInfo {
    requesttokens: number;
    streamedtokens: number;
}

export type CountTokenRequest = {
    text: string;
    model: Model;
};

export type CountTokenResponse = {
    count: number;
};
