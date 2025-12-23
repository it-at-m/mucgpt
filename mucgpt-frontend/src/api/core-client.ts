import { getConfig, handleApiRequest, postConfig } from "./fetch-utils";
import { ApplicationConfig, ChatRequest, CountTokenRequest, CountTokenResponse, CreateAssistantRequest, ToolListResponse } from "./models";
export const CHAT_NAME_PROMPT =
    "Gebe dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen, bestehend aus maximal 5 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Antworte nur mit dem vollständigen Namen und keinem weiteren Text, damit deine Antwort direkt weiterverwendet werden kann. Benutze keine Sonderzeichen sondern lediglich Zahlen und Buchstaben. Antworte in keinem Fall mit etwas anderem als dem Chat namen. Antworte immer nur mit dem namen des Chats";

export const API_BASE = "/api/backend/";

export async function getTools(lang?: string): Promise<ToolListResponse> {
    const url = lang ? `${API_BASE}v1/tools?lang=${encodeURIComponent(lang)}` : `${API_BASE}v1/tools`;
    return handleApiRequest(() => fetch(url, getConfig()), "Failed to get tools");
}

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = API_BASE + "v1/chat/completions";
    // build OpenAI-compatible messages array
    const messages: Array<{ role: string; content: string }> = [];
    if (options.system_message) {
        messages.push({ role: "system", content: options.system_message });
    }
    for (const turn of options.history) {
        messages.push({ role: "user", content: turn.user });
        if (turn.assistant !== undefined) {
            messages.push({ role: "assistant", content: turn.assistant });
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
    if (options.assistant_id) {
        body.assistant_id = options.assistant_id;
    }
    return await fetch(url, postConfig(body));
}

export async function configApi(): Promise<ApplicationConfig> {
    return handleApiRequest(() => fetch(API_BASE + "config", getConfig()), "Failed to get application config");
}

export async function countTokensAPI(options: CountTokenRequest): Promise<CountTokenResponse> {
    return handleApiRequest(
        () =>
            fetch(
                API_BASE + "counttokens",
                postConfig({
                    text: options.text,
                    model: options.model.llm_name
                })
            ),
        "Failed to count tokens"
    );
}

export async function createAssistantApi(options: CreateAssistantRequest): Promise<Response> {
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

    const parsedResponse: any = await handleApiRequest(() => fetch(url, postConfig(body)), "Failed to create chat name");

    // Extract content from ChatCompletion response
    return parsedResponse.choices?.[0]?.message?.content || "New Chat";
}
