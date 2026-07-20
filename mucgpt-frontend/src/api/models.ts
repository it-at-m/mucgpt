import { StarterPromptModel } from "../components/StarterPrompt";
import { FollowUpActionModel } from "../components/FollowUpAction";

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
    assistant?: string;
};

export type DataSource = {
    title: string;
    content: string;
    metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type ChatRequest = {
    history: ChatTurn[];
    creativity?: string;
    temperature?: number; // Deprecated: for backward compatibility
    language?: string;
    system_message?: string;
    shouldStream?: boolean;
    model?: string;
    enabled_tools?: string[];
    assistant_id?: string;
    data_sources?: DataSource[];
};

export type AssistantDraftRequest = {
    prompt_seed: string;
};

export type AssistantDraftResponse = {
    system_prompt: string;
    description: string;
    title: string;
};

export type ChatTitleResponse = {
    title: string;
};

export interface ApplicationConfig {
    models: Model[];
    alternative_logo: boolean;
    env_name: string;
    app_version: string;
    core_version: string;
    frontend_version: string;
    assistant_version: string;
    document_processing_enabled: boolean;
    transcription_enabled: boolean;
    footer_link_url?: string;
    footer_label?: string;
    faq_url?: string;
    incident_report_url?: string;
    feature_request_url?: string;
    contact_mail_url?: string;
    ad2image_url?: string;
}

export interface Model {
    llm_name: string;
    max_input_tokens?: number | null;
    description?: string | null;
    max_output_tokens?: number | null;
    knowledge_cut_off?: string | null;
    input_cost_per_token?: number | null;
    output_cost_per_token?: number | null;
    supports_function_calling?: boolean | null;
    supports_reasoning?: boolean | null;
    supports_vision?: boolean | null;
    litellm_provider?: string | null;
    inference_location?: string | null;
}

export interface Labels {
    env_name: string;
}

// OpenAI-compatible streaming chunk types
export interface ToolCall {
    name: string;
    state: string;
    content: string;
    metadata?: Record<string, unknown>;
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

export interface DirectoryNode {
    shortname?: string | null;
    name: string;
    children?: DirectoryNode[];
}

export type Assistant = {
    title: string;
    description: string;
    system_message: string;
    publish: boolean;
    id?: string;
    creativity: string;
    default_model?: string;
    examples?: StarterPromptModel[];
    quick_prompts?: FollowUpActionModel[];
    version: string;
    owner_ids?: string[];
    tags?: string[];
    hierarchical_access?: string[];
    tools?: ToolBase[];
    is_visible: boolean;
};

export interface ToolBase {
    id: string;
    config?: Record<string, unknown>;
}

export interface OwnerDetailsResponse {
    user_id: string;
    username: string;
    contact_address?: string | null;
    givenName?: string | null;
    sn?: string | null;
    mail?: string | null;
    organizationalunit?: string | null;
}

export interface StarterPromptInput {
    text: string;
    value: string;
}

export interface AssistantCreateInput {
    name: string;
    description?: string;
    system_prompt: string;
    hierarchical_access?: string[];
    creativity?: string;
    default_model?: string;
    tools?: ToolBase[];
    owner_ids?: string[];
    examples?: StarterPromptInput[];
    quick_prompts?: FollowUpActionModel[];
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
    creativity: string;
    temperature?: number; // Deprecated: legacy support
    default_model?: string;
    tools?: ToolBase[];
    owner_ids?: string[];
    owners_detailed?: OwnerDetailsResponse[];
    examples?: StarterPromptInput[];
    quick_prompts?: FollowUpActionModel[];
    tags?: string[];
    is_visible: boolean;
}

export interface AssistantCreateResponse {
    id: string;
    created_at: string;
    updated_at: string;
    hierarchical_access?: string[];
    owner_ids?: string[];
    owners_detailed?: OwnerDetailsResponse[];
    latest_version: AssistantVersionResponse;
}

export interface AssistantUpdateInput {
    name?: string;
    description?: string;
    system_prompt?: string;
    hierarchical_access?: string[];
    creativity?: string;
    default_model?: string;
    tools?: ToolBase[];
    owner_ids?: string[];
    examples?: StarterPromptInput[];
    quick_prompts?: FollowUpActionModel[];
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
    owners_detailed?: OwnerDetailsResponse[];
    latest_version: AssistantVersionResponse;
    is_visible: boolean;
}

// Tool info and list response for /tools endpoint
export interface ToolInfo {
    id: string;
    name: string;
    description: string;
    mcp_source?: string | null;
    mcp_scope?: string | null;
    mcp_group?: string | null;
}

export interface ToolListResponse {
    tools: ToolInfo[];
}

export interface User {
    sub?: string;
    name?: string;
    family_name?: string;
    given_name?: string;
    middle_name?: string;
    email?: string;
    preferred_username?: string;
    department?: string;
    lhmObjectID?: string;
}

export type CommunityAssistant = {
    title: string;
    description: string;
    id: string;
    updated_at?: string;
    subscriptions_count?: number;
    tags?: string[];
    is_visible?: boolean;
};

export type CommunityAssistantSnapshot = {
    snapshot_version: number;
    id: string;
    title: string;
    description: string;
    system_message: string;
    creativity: string;
    version: string;
    default_model?: string;
    examples?: StarterPromptInput[];
    quick_prompts?: FollowUpActionModel[];
    tags?: string[];
    hierarchical_access?: string[];
    tools?: ToolBase[];
    is_visible: boolean;
};
