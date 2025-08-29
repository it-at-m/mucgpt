import { getConfig, handleApiRequest, postConfig, deleteConfig } from "./fetch-utils";
import { AssistantCreateInput, AssistantCreateResponse, AssistantResponse, AssistantUpdateInput, Assistant, CommunityAssistant } from "./models";

/**
 * Get all assistants the user is subscribed to (ID and name only).
 * @returns Array of SubscriptionResponse
 */

export async function getUserSubscriptionsApi(): Promise<CommunityAssistant[]> {
    return handleApiRequest(() => fetch("/api/user/subscriptions", getConfig()), "Failed to get user subscriptions");
} /**
 * Unsubscribe the current user from an assistant.
 * @param assistantId The assistant's ID.
 * @returns StatusResponse
 */

export async function unsubscribeFromAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/user/subscriptions/${assistantId}`, deleteConfig()), "Failed to unsubscribe from assistant");
}
export async function subscribeToAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/user/subscriptions/${assistantId}`, postConfig({})), "Failed to subscribe to assistant");
}
export async function getOwnedCommunityAssistants(): Promise<AssistantResponse[]> {
    return handleApiRequest(() => fetch("/api/user/assistants", getConfig()), "Failed to get owned community assistants");
}
export async function createCommunityAssistantApi(input: AssistantCreateInput): Promise<AssistantCreateResponse> {
    return handleApiRequest(() => fetch("/api/assistant/create", postConfig(input)), "Failed to create community assistant");
}

export async function getAllCommunityAssistantsApi(): Promise<AssistantResponse[]> {
    return handleApiRequest(() => fetch("/api/assistant", getConfig()), "Failed to get all community assistants");
}

export async function getCommunityAssistantApi(id: string): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}`, getConfig()), "Failed to get community assistant");
}

export async function updateCommunityAssistantApi(id: string, input: AssistantUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/update`, postConfig(input)), "Failed to update community assistant");
}

export async function deleteCommunityAssistantApi(id: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/delete`, postConfig({})), "Failed to delete community assistant");
}

export async function getCommunityAssistantVersionApi(id: string, version: string): Promise<Assistant> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/version/${version}`, getConfig()), "Failed to get community assistant version");
}
