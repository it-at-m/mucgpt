import { API_BASE } from "./core-client";
import type { ChatResponse } from "./models";
import { ApiError, deleteConfig, getConfig, handleApiRequest, handleRedirect } from "./fetch-utils";

export interface ConversationMetadata {
    conversation_id: string;
    assistant_id: string | null;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface ConversationMessage {
    role: "system" | "user" | "assistant";
    content: string;
    usage?: Pick<
        ChatResponse,
        | "context_tokens"
        | "user_tokens"
        | "tokens"
        | "usage_cost"
        | "usage_model"
        | "usage_max_input_tokens"
        | "usage_context_warning_threshold_percent"
        | "usage_context_critical_threshold_percent"
    > | null;
    activity_steps?: {
        tool_call_id: string;
        tool_name: string;
        status: "done" | "error";
        description?: string | null;
        detail?: string | null;
    }[];
}

export function listConversationsApi(): Promise<ConversationMetadata[]> {
    return handleApiRequest(() => fetch(API_BASE + "v1/conversations", getConfig()), "Failed to load conversation history");
}

export async function getConversationMessagesApi(conversationId: string): Promise<ConversationMessage[]> {
    const response = await fetch(API_BASE + "v1/conversations/" + encodeURIComponent(conversationId) + "/messages", getConfig());
    handleRedirect(response);
    if (!response.ok) {
        throw new ApiError("Failed to load conversation messages", response.status);
    }
    return response.json();
}

/** Deletes server state; success and 404 complete deletion, while other failures propagate for retry. */
export async function deleteConversationApi(conversationId: string): Promise<void> {
    const response = await fetch(API_BASE + "v1/conversations/" + encodeURIComponent(conversationId), deleteConfig());
    handleRedirect(response);
    if (!response.ok && response.status !== 404) {
        throw new ApiError("Failed to delete conversation", response.status);
    }
}
