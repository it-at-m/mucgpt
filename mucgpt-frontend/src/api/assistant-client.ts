import { getConfig, handleApiRequest, handleRedirect, handleResponse, postConfig } from "./fetch-utils";
import { AssistantCreateInput, AssistantCreateResponse, AssistantResponse, AssistantUpdateInput, Bot } from "./models";

/**
 * Get all assistants the user is subscribed to (ID and name only).
 * @returns Array of SubscriptionResponse
 */

export async function getUserSubscriptionsApi(): Promise<{ id: string; name: string; description: string }[]> {
    const response = await fetch("/api/user/subscriptions", getConfig());
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
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
    const response = await fetch("/api/user/bots", getConfig());
    handleRedirect(response, true);
    const parsedResponse: AssistantResponse[] = await handleResponse(response);
    return parsedResponse;
}
export async function createCommunityAssistantApi(input: AssistantCreateInput): Promise<AssistantCreateResponse> {
    const response = await fetch("/api/bot/create", postConfig(input));
    handleRedirect(response, true);
    const parsedResponse: AssistantCreateResponse = await handleResponse(response);
    return parsedResponse;
}

export async function getAllCommunityAssistantsApi(): Promise<AssistantResponse[]> {
    const response = await fetch("/api/bot", getConfig());
    handleRedirect(response, true);
    const parsedResponse: AssistantResponse[] = await handleResponse(response);
    return parsedResponse;
}

export async function getCommunityAssistantApi(id: string): Promise<AssistantResponse> {
    const response = await fetch(`/api/bot/${id}`, getConfig());
    handleRedirect(response, true);
    const parsedResponse: AssistantResponse = await handleResponse(response);
    return parsedResponse;
}

export async function updateCommunityAssistantApi(id: string, input: AssistantUpdateInput): Promise<AssistantResponse> {
    const response = await fetch(`/api/bot/${id}/update`, postConfig(input));
    handleRedirect(response, true);
    const parsedResponse: AssistantResponse = await handleResponse(response);
    return parsedResponse;
}

export async function deleteCommunityAssistantApi(id: string): Promise<{ message: string }> {
    const response = await fetch(`/api/bot/${id}/delete`, postConfig({}));
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
}

export async function getCommunityAssistantVersionApi(id: string, version: string): Promise<Bot> {
    const response = await fetch(`/api/bot/${id}/version/${version}`, getConfig());
    handleRedirect(response, true);
    const parsedResponse: Bot = await handleResponse(response);
    return parsedResponse;
}
