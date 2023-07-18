export const enum Approaches {
    RetrieveThenRead = "rtr",
    ReadRetrieveRead = "rrr",
    ReadDecomposeAsk = "rda",
    Summarize = "sum"
}

export type AskRequestOverrides = {
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
    thoughts: string | null;
    data_points: string[];
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
};

export type SumRequestOverrides = {
    person_type?: string;
    temperature?: number;
    language?: string;
    sumlength?: string;
};

export type SumRequest = {
    text: string;
    approach: Approaches;
    overrides?: SumRequestOverrides;
};

