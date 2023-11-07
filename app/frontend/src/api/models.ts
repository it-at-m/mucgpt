export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda",
    Chat = "chat",
    Summarize = "sum",
    Brainstorm = "brainstorm"
}

export const enum RetrievalMode {
    Hybrid = "hybrid",
    Vectors = "vectors",
    Text = "text"
}

export type AskRequestOverrides = {
    retrievalMode?: RetrievalMode;
    semanticRanker?: boolean;
    semanticCaptions?: boolean;
    excludeCategory?: string;
    top?: number;
    temperature?: number;
    promptTemplate?: string;
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
    suggestFollowupQuestions?: boolean;
    language?: string;
};

export type AskRequest = {
    question: string;
    approach: Approaches;
    overrides?: AskRequestOverrides;
};

export type AskResponse = {
    answer: string;
    error?: string;
    tokens?: number;
};

export type DenseSummary = {
    missing_entities: string[];
    denser_summary: string
}

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
    approach: Approaches;
    overrides?: AskRequestOverrides;
    shouldStream?: boolean;
};

export type SumRequestOverrides = {
    temperature?: number;
    language?: string;
};

export type SumRequest = {
    text: string;
    approach: Approaches;
    overrides?: SumRequestOverrides;
};

export type BrainstormRequestOverrides = {
    temperature?: number;
    language?: string;
};

export type BrainstormRequest = {
    topic: string;
    approach: Approaches;
    overrides?: BrainstormRequestOverrides;
};

