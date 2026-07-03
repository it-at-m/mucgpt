import { getConfig, handleApiRequest, postConfig, postFormDataConfig } from "./fetch-utils";
import { ApplicationConfig, ChatRequest, CountTokenRequest, CountTokenResponse, CreateAssistantRequest, ToolListResponse } from "./models";

const PARSE_SERVICE_BASE = "/api/backend/v1/parse";
export const CHAT_NAME_PROMPT =
    "Gib dem bisherigen Chatverlauf einen passenden und aussagekräftigen Namen mit maximal 4 Wörtern. Über diesen Namen soll klar ersichtlich sein, welches Thema der Chat behandelt. Trenne jedes Wort mit einem Leerzeichen. Verwende kein CamelCase und klebe keine Wörter zusammen. Verwende deutsche Umlaute direkt, also ä, ö, ü und ß, statt ae, oe, ue oder ss. Verwende keine Anführungszeichen, kein Markdown, keine Satzzeichen und keine Zeilenumbrüche. Antworte nur mit dem vollständigen Namen und keinem weiteren Text, damit die Antwort direkt als Chatname verwendet werden kann.";

const MAX_CHAT_NAME_WORDS = 4;
const MAX_CHAT_NAME_LENGTH = 48;

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

export async function createAssistantApi(options: CreateAssistantRequest): Promise<Response> {
    return await fetch(
        API_BASE + "v1/generate/assistant",
        postConfig({
            input: options.input,
            model: options.model
        })
    );
}

export async function createChatName(query: string, answer: string, language: string, creativity: string, system_message: string, model: string) {
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
        creativity: creativity,
        stream: false
    };

    const parsedResponse: any = await handleApiRequest(() => fetch(url, postConfig(body)), "Failed to create chat name");

    const generatedName = parsedResponse.choices?.[0]?.message?.content;
    return normalizeChatName(generatedName) || normalizeChatName(query) || "New Chat";
}

function normalizeChatName(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }

    const words = value
        .replace(/["']/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean)
        .slice(0, MAX_CHAT_NAME_WORDS);

    let title = words.join(" ");
    if (title.length > MAX_CHAT_NAME_LENGTH) {
        title = title.slice(0, MAX_CHAT_NAME_LENGTH).trimEnd();
    }

    return title;
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
