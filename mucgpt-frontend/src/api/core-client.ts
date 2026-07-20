import { getConfig, handleApiRequest, postConfig, postFormDataConfig } from "./fetch-utils";
import {
    ApplicationConfig,
    AssistantDraftRequest,
    AssistantDraftResponse,
    ChatTitleResponse,
    ChatRequest,
    CountTokenRequest,
    CountTokenResponse,
    ToolListResponse
} from "./models";

const PARSE_SERVICE_BASE = "/api/backend/v1/parse";

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
    const body: {
        model?: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        stream?: boolean;
        creativity?: string;
        enabled_tools?: string[];
        assistant_id?: string;
        data_sources?: ChatRequest["data_sources"];
    } = {
        model: options.model,
        messages,
        temperature: options.temperature,
        stream: options.shouldStream,
        creativity: options.creativity
    };
    if (options.enabled_tools) {
        body.enabled_tools = options.enabled_tools;
    }
    if (options.assistant_id) {
        body.assistant_id = options.assistant_id;
    }
    if (options.data_sources) {
        body.data_sources = options.data_sources;
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

export async function generateAssistantDraftApi(request: AssistantDraftRequest): Promise<AssistantDraftResponse> {
    return handleApiRequest(
        () => fetch(API_BASE + "v1/generations/assistant-draft", postConfig({ system_prompt: request.system_prompt })),
        "Failed to generate assistant draft"
    );
}

export async function createChatName(query: string, answer: string, system_message: string) {
    const url = API_BASE + "v1/generations/chat-title";
    const body = {
        query,
        answer,
        system_message
    };

    const parsedResponse = await handleApiRequest<ChatTitleResponse>(() => fetch(url, postConfig(body)), "Failed to create chat name");

    const generatedName = parsedResponse.title;
    return generatedName || "New Chat";
}

/**
 * Uploads a file, parses it, and returns the extracted text content directly.
 * @param file The file to upload and parse
 * @returns Extracted text content as a string
 */
export async function uploadFileApi(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    return handleApiRequest(async () => {
        const response = await fetch(`${PARSE_SERVICE_BASE}`, postFormDataConfig(formData));
        return response;
    }, "Failed to upload file");
}
