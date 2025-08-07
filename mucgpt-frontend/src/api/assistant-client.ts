import { getConfig, handleApiRequest, postConfig } from "./fetch-utils";
import { AssistantCreateInput, AssistantCreateResponse, AssistantResponse, AssistantUpdateInput, Bot } from "./models";

/**
 * Get all assistants the user is subscribed to (ID and name only).
 * @returns Array of SubscriptionResponse
 */

export async function getUserSubscriptionsApi(): Promise<{ id: string; name: string; description: string }[]> {
    return handleApiRequest(() => fetch("/api/user/subscriptions", getConfig()), "Failed to get user subscriptions");
} /**
 * Unsubscribe the current user from an assistant.
 * @param assistantId The assistant's ID.
 * @returns StatusResponse
 */

export async function unsubscribeFromAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(
        () =>
            fetch(`/api/user/subscriptions/${assistantId}`, {
                method: "DELETE",
                headers: {
                    ...getConfig().headers
                }
            }),
        "Failed to unsubscribe from assistant"
    );
}
export async function subscribeToAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/user/subscriptions/${assistantId}`, postConfig({})), "Failed to subscribe to assistant");
}
export async function getOwnedCommunityBots(): Promise<AssistantResponse[]> {
    return handleApiRequest(() => fetch("/api/user/bots", getConfig()), "Failed to get owned community bots");
}
export async function createCommunityAssistantApi(input: AssistantCreateInput): Promise<AssistantCreateResponse> {
    return handleApiRequest(() => fetch("/api/bot/create", postConfig(input)), "Failed to create community assistant");
}

export async function getAllCommunityAssistantsApi(): Promise<AssistantResponse[]> {
    return handleApiRequest(() => fetch("/api/bot", getConfig()), "Failed to get all community assistants");
}

export async function getCommunityAssistantApi(id: string): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/bot/${id}`, getConfig()), "Failed to get community assistant");
}

export async function updateCommunityAssistantApi(id: string, input: AssistantUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/bot/${id}/update`, postConfig(input)), "Failed to update community assistant");
}

export async function deleteCommunityAssistantApi(id: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/bot/${id}/delete`, postConfig({})), "Failed to delete community assistant");
}

export async function getCommunityAssistantVersionApi(id: string, version: string): Promise<Bot> {
    return handleApiRequest(() => fetch(`/api/bot/${id}/version/${version}`, getConfig()), "Failed to get community assistant version");
}
