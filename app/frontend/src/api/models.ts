export type AskRequestOverrides = {
    temperature?: number;
    language?: string;
    max_tokens?: number;
    system_message?: string;
};

export type AskRequest = {
    question: string;
    overrides?: AskRequestOverrides;
};

export type AskResponse = {
    answer: string;
    error?: string;
    tokens?: number;
};

export type DenseSummary = {
    missing_entities: string[];
    denser_summary: string;
};

export type SumResponse = {
    answer: DenseSummary[];
    error?: string;
};

export type ChatTurn = {
    user: string;
    bot?: string;
};

export type ChatRequest = {
    history: ChatTurn[];
    overrides?: AskRequestOverrides;
    shouldStream?: boolean;
};

export type SumRequestOverrides = {
    temperature?: number;
    language?: string;
};

export type SumRequest = {
    text: string;
    overrides?: SumRequestOverrides;
};

export type BrainstormRequestOverrides = {
    temperature?: number;
    language?: string;
};

export type BrainstormRequest = {
    topic: string;
    overrides?: BrainstormRequestOverrides;
};

export interface ApplicationConfig {
    backend: Backend;
    frontend: Frontend;
    version: string;
}

export interface Backend {
    features: BackendFeatures;
}

export interface BackendFeatures {
    enable_auth: boolean;
}

export interface Frontend {
    features: FrontendFeatures;
    labels: Labels;
}

export interface FrontendFeatures {}

export interface Labels {
    env_name: string;
}
