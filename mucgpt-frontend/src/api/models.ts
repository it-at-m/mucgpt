import { ExampleModel } from "../components/Example";
import { QuickPrompt } from "../components/QuickPrompt/QuickPrompt";

export type AskResponse = {
    answer: string;
    error?: string;
    tokens?: number;
};

export type ChatResponse = {
    answer: string;
    error?: string;
    tokens?: number;
    user_tokens?: number;
    activeTools?: Array<{
        name: string;
        message: string;
        state: "STARTED" | "ENDED" | null;
        timestamp: number;
    }>;
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
    enabled_tools?: string[];
    bot_id?: string;
};

export type CreateBotRequest = {
    input: string;
    max_output_tokens: number;
    model?: string;
};

export interface ApplicationConfig {
    models: Model[];
    frontend: Frontend;
    version: string;
    commit: string;
}

export interface Frontend {
    alternative_logo: boolean;
    labels: Labels;
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

// OpenAI-compatible streaming chunk types
export interface ToolCall {
    name: string;
    state: string;
    content: string;
    metadata?: Record<string, any>;
}

export interface ChatCompletionDelta {
    role?: "system" | "user" | "assistant";
    content?: string;
    tool_calls?: ToolCall[];
}

export interface ChatCompletionChunkChoice {
    delta: ChatCompletionDelta;
    index: number;
    finish_reason?: string;
}

export interface ChatCompletionChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    choices: ChatCompletionChunkChoice[];
}

export type CountTokenRequest = {
    text: string;
    model: Model;
};

export type CountTokenResponse = {
    count: number;
};

export type DepartementsResponse = {
    departments: string[];
};

export type Bot = {
    title: string;
    description: string;
    system_message: string;
    publish: boolean;
    id?: string;
    temperature: number;
    max_output_tokens: number;
    examples?: ExampleModel[];
    quick_prompts?: QuickPrompt[];
    version: string;
    owner_ids?: string[];
    tags?: string[];
    hierarchical_access?: string[];
    tools?: ToolBase[];
    is_visible: boolean;
};

export interface ToolBase {
    id: string;
    config?: Record<string, any>;
}

export interface ExampleModelInput {
    text: string;
    value: string;
}

export interface AssistantCreateInput {
    name: string;
    description?: string;
    system_prompt: string;
    hierarchical_access?: string[];
    temperature?: number;
    max_output_tokens: number;
    tools?: ToolBase[];
    owner_ids?: string[];
    examples?: ExampleModelInput[];
    quick_prompts?: QuickPrompt[];
    tags?: string[];
    is_visible: boolean;
}

export interface AssistantVersionResponse {
    id: string;
    version: number;
    created_at: string;
    name: string;
    description?: string;
    system_prompt: string;
    hierarchical_access?: string[];
    temperature: number;
    max_output_tokens: number;
    tools?: ToolBase[];
    owner_ids?: string[];
    examples?: ExampleModelInput[];
    quick_prompts?: QuickPrompt[];
    tags?: string[];
    is_visible: boolean;
}

export interface AssistantCreateResponse {
    id: string;
    created_at: string;
    updated_at: string;
    hierarchical_access?: string[];
    owner_ids?: string[];
    latest_version: AssistantVersionResponse;
}

export interface AssistantUpdateInput {
    name?: string;
    description?: string;
    system_prompt?: string;
    hierarchical_access?: string[];
    temperature?: number;
    max_output_tokens?: number;
    tools?: ToolBase[];
    owner_ids?: string[];
    examples?: ExampleModelInput[];
    quick_prompts?: QuickPrompt[];
    tags?: string[];
    is_visible: boolean;
    version: number;
}

export interface AssistantResponse {
    id: string;
    created_at: string;
    updated_at: string;
    subscriptions_count: number;
    hierarchical_access?: string[];
    owner_ids?: string[];
    latest_version: AssistantVersionResponse;
}

// Tool info and list response for /tools endpoint
export interface ToolInfo {
    id: string;
    name: string;
    description: string;
}

export interface ToolListResponse {
    tools: ToolInfo[];
}

export interface User {
    sub?: string;
    // LHM
    displayName?: string;
    surname?: string;
    telephoneNumber?: string;
    email?: string;
    username?: string;
    givenname?: string;
    department?: string;
    lhmObjectID?: string;
    // LHM_Extended
    preferred_username?: string;
    memberof?: string[];
    user_roles?: string[];
    authorities?: string[];
}
