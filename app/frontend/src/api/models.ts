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
    max_output_tokens?: number;
    system_message?: string;
    shouldStream?: boolean;
    model?: string;
};

export type SumRequest = {
    text: string;
    detaillevel?: "short" | "medium" | "long";
    language?: string;
    model: string;
};
export type BrainstormRequest = {
    topic: string;
    model: string;
    temperature?: number;
    language?: string;
};

export type SimplyRequest = {
    topic: string;
    temperature?: number;
    model?: string;
    output_type: string;
};

export interface ApplicationConfig {
    models: Model[];
    frontend: Frontend;
    version: string;
}

export interface Frontend {
    alternative_logo: boolean;
    labels: Labels;
    enable_simply: boolean;
}

export interface Model {
    llm_name: string;
    max_output_tokens: number;
    max_input_tokens: number;
    description: string;
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
export type SimplyResponse = {
    content: string;
    error?: string;
};
