import { parse } from "uuid";
import { getConfig, getXSRFToken, handleRedirect, handleResponse, postConfig } from "./fetch-utils";
import {
    ApplicationConfig,
    AskResponse,
    AssistantCreateInput,
    AssistantCreateResponse,
    BrainstormRequest,
    ChatRequest,
    ChatTurn,
    CountTokenRequest,
    CountTokenResponse,
    CreateBotRequest,
    DepartementsResponse,
    SimplyRequest,
    SimplyResponse,
    SumRequest,
    SumResponse,
    AssistantResponse,
    AssistantUpdateInput,
    Bot
} from "./models";

const CHAT_NAME_PROMPT =
    "Gebe dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen, bestehend aus maximal 5 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Antworte nur mit dem vollständigen Namen und keinem weiteren Text, damit deine Antwort direkt weiterverwendet werden kann. Benutze keine Sonderzeichen sondern lediglich Zahlen und Buchstaben. Antworte in keinem Fall mit etwas anderem als dem Chat namen. Antworte immer nur mit dem namen des Chats";
const API_BASE = "/api/backend/";

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = options.shouldStream ? API_BASE + "chat_stream" : API_BASE + "chat";
    return await fetch(
        url,
        postConfig({
            history: options.history,
            temperature: options.temperature,
            language: options.language,
            system_message: options.system_message,
            max_output_tokens: options.max_output_tokens,
            model: options.model
        })
    );
}

export async function sumApi(options: SumRequest, file?: File): Promise<SumResponse> {
    const formData = new FormData();
    formData.append(
        "body",
        JSON.stringify({
            text: options.text,
            detaillevel: options.detaillevel,
            language: options.language,
            model: options.model
        })
    );
    if (file) formData.append("file", file);
    const headers = {
        "X-XSRF-TOKEN": getXSRFToken()
    };
    const response = await fetch(API_BASE + "sum", {
        method: "POST",
        headers: headers,
        mode: "cors",
        redirect: "manual",
        body: formData
    });

    const parsedResponse: SumResponse = await handleResponse(response);

    return parsedResponse;
}

export async function configApi(): Promise<ApplicationConfig> {
    return await fetch(API_BASE + "config", getConfig()).then(async response => {
        handleRedirect(response, false);
        const parsedResponse = await handleResponse(response);
        return parsedResponse;
    });
}

export async function brainstormApi(options: BrainstormRequest): Promise<AskResponse> {
    const response = await fetch(
        API_BASE + "brainstorm",
        postConfig({
            topic: options.topic,
            temperature: options.temperature,
            language: options.language,
            model: options.model
        })
    );

    handleRedirect(response, true);
    const parsedResponse: AskResponse = await handleResponse(response);
    return parsedResponse;
}

export async function simplyApi(options: SimplyRequest): Promise<SimplyResponse> {
    const response = await fetch(
        API_BASE + "simply",
        postConfig({
            topic: options.topic,
            temperature: options.temperature,
            model: options.model
        })
    );
    handleRedirect(response);
    const parsedResponse: SimplyResponse = await handleResponse(response);
    return parsedResponse;
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
    const parsedResponse: string[] = await handleResponse(response);
    return parsedResponse;
}

export async function createBotApi(options: CreateBotRequest): Promise<Response> {
    return await fetch(
        API_BASE + "create_bot",
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
    const history: ChatTurn[] = [{ user: query, bot: answer }];
    const request: ChatRequest = {
        history: [
            ...history,
            {
                user: CHAT_NAME_PROMPT,
                bot: undefined
            }
        ],
        shouldStream: false,
        language: language,
        temperature: temperature,
        system_message: system_message,
        max_output_tokens: max_output_tokens,
        model: model
    };
    const response = await chatApi(request);
    handleRedirect(response);

    if (!response.body) {
        throw Error("No response body");
    }
    const parsedResponse = (await response.json()) as SimplyResponse;
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse.content;
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
