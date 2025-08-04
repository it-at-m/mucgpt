import { getConfig, handleRedirect, handleResponse, postConfig } from "./fetch-utils";
import {
    ApplicationConfig,
    AssistantCreateInput,
    AssistantCreateResponse,
    ChatRequest,
    CountTokenRequest,
    CountTokenResponse,
    CreateBotRequest,
    AssistantResponse,
    AssistantUpdateInput,
    Bot,
    ToolListResponse
} from "./models";

const CHAT_NAME_PROMPT =
    "Gebe dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen, bestehend aus maximal 5 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Antworte nur mit dem vollständigen Namen und keinem weiteren Text, damit deine Antwort direkt weiterverwendet werden kann. Benutze keine Sonderzeichen sondern lediglich Zahlen und Buchstaben. Antworte in keinem Fall mit etwas anderem als dem Chat namen. Antworte immer nur mit dem namen des Chats";
const API_BASE = "/api/backend/";

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = API_BASE + "v1/chat/completions";
    // build OpenAI-compatible messages array
    const messages: Array<{ role: string; content: string }> = [];
    if (options.system_message) {
        messages.push({ role: "system", content: options.system_message });
    }
    for (const turn of options.history) {
        messages.push({ role: "user", content: turn.user });
        if (turn.bot !== undefined) {
            messages.push({ role: "assistant", content: turn.bot });
        }
    }
    const body: any = {
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_output_tokens,
        stream: options.shouldStream
    };
    if (options.enabled_tools) {
        body.enabled_tools = options.enabled_tools;
    }
    return await fetch(url, postConfig(body));
}

export async function configApi(): Promise<ApplicationConfig> {
    return await fetch(API_BASE + "config", getConfig()).then(async response => {
        handleRedirect(response, false);
        const parsedResponse = await handleResponse(response);
        return parsedResponse;
    });
}

export async function countTokensAPI(options: CountTokenRequest): Promise<CountTokenResponse> {
    const response = await fetch(
        API_BASE + "counttokens",
        postConfig({
            text: options.text,
            model: options.model.llm_name
        })
    );

    handleRedirect(response, true);
    const parsedResponse: CountTokenResponse = await handleResponse(response);
    return parsedResponse;
}

export async function getDepartements(): Promise<string[]> {
    const response = await fetch(API_BASE + "departements", getConfig());
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
}

export async function createBotApi(options: CreateBotRequest): Promise<Response> {
    return await fetch(
        API_BASE + "v1/generate/assistant",
        postConfig({
            input: options.input,
            model: options.model,
            max_output_tokens: options.max_output_tokens
        })
    );
}

export async function createChatName(
    query: string,
    answer: string,
    language: string,
    temperature: number,
    system_message: string,
    max_output_tokens: number,
    model: string
) {
    const url = API_BASE + "v1/chat/completions";
    // build OpenAI-compatible messages array
    const messages: Array<{ role: string; content: string }> = [];
    if (system_message) {
        messages.push({ role: "system", content: system_message });
    }
    messages.push({ role: "user", content: query });
    messages.push({ role: "assistant", content: answer });
    messages.push({ role: "user", content: CHAT_NAME_PROMPT });

    const body = {
        model: model,
        messages,
        temperature: temperature,
        max_tokens: max_output_tokens,
        stream: false
    };

    const response = await fetch(url, postConfig(body));
    handleRedirect(response);

    if (!response.body) {
        throw Error("No response body");
    }

    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    // Extract content from ChatCompletion response
    return parsedResponse.choices?.[0]?.message?.content || "New Chat";
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

export async function getOwnedCommunityBots(): Promise<AssistantResponse[]> {
    const response = await fetch("/api/user/bots", getConfig());
    handleRedirect(response, true);
    const parsedResponse: AssistantResponse[] = await handleResponse(response);
    return parsedResponse;
}

/**
 * Subscribe the current user to an assistant.
 * @param assistantId The assistant's ID.
 * @returns StatusResponse
 */
export async function subscribeToAssistantApi(assistantId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/user/subscriptions/${assistantId}`, postConfig({}));
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
}

/**
 * Unsubscribe the current user from an assistant.
 * @param assistantId The assistant's ID.
 * @returns StatusResponse
 */
export async function unsubscribeFromAssistantApi(assistantId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/user/subscriptions/${assistantId}`, {
        method: "DELETE",
        headers: {
            ...getConfig().headers
        }
    });
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
}

/**
 * Get all assistants the user is subscribed to (ID and name only).
 * @returns Array of SubscriptionResponse
 */
export async function getUserSubscriptionsApi(): Promise<{ id: string; name: string }[]> {
    const response = await fetch("/api/user/subscriptions", getConfig());
    handleRedirect(response, true);
    const parsedResponse = await handleResponse(response);
    return parsedResponse;
}

export async function getTools(): Promise<ToolListResponse> {
    const response = await fetch(API_BASE + "v1/tools", getConfig());
    handleRedirect(response, true);
    const parsedResponse: ToolListResponse = await handleResponse(response);
    return parsedResponse;
}
