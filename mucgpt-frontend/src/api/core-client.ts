import { getConfig, getHeaders, handleApiRequest, handleRedirect, postConfig, postFormDataConfig } from "./fetch-utils";
import {
    ApplicationConfig,
    AssistantDraftRequest,
    AssistantDraftResponse,
    ChatTitleResponse,
    ChatRequest,
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    CountTokenRequest,
    CountTokenResponse,
    ToolListResponse
} from "./models";
import { HttpAgent } from "@ag-ui/client";
import type { RunAgentInput } from "@ag-ui/core";

const PARSE_SERVICE_BASE = "/api/backend/v1/parse";

export const API_BASE = "/api/backend/";

const AG_UI_CHAT_URL = API_BASE + "v1/chat/v2/completions";

function toChatCompletionBody(options: ChatRequest) {
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

    return {
        model: options.model,
        messages,
        temperature: options.temperature,
        stream: options.shouldStream,
        creativity: options.creativity,
        ...(options.enabled_tools ? { enabled_tools: options.enabled_tools } : {}),
        ...(options.assistant_id ? { assistant_id: options.assistant_id } : {}),
        ...(options.conversation_id ? { conversation_id: options.conversation_id } : {}),
        ...(options.data_sources ? { data_sources: options.data_sources } : {})
    };
}

/**
 * AG-UI client for the transitional endpoint, which emits AG-UI events but
 * still accepts MUCGPT's existing chat request envelope.
 */
export class MucgptAgUiAgent extends HttpAgent {
    constructor(private readonly request: ChatRequest) {
        super({
            url: AG_UI_CHAT_URL,
            threadId: request.conversation_id,
            fetch: async (url, init) => {
                const response = await fetch(url, init);
                handleRedirect(response);
                return response;
            }
        });
    }

    protected override requestInit(_input: RunAgentInput): RequestInit {
        const headers = getHeaders();
        headers.set("Accept", "text/event-stream");

        return {
            method: "POST",
            body: JSON.stringify(toChatCompletionBody(this.request)),
            headers,
            mode: "cors",
            credentials: "same-origin",
            redirect: "manual",
            signal: this.abortController.signal
        };
    }
}

export async function getTools(lang?: string): Promise<ToolListResponse> {
    const url = lang ? `${API_BASE}v1/tools?lang=${encodeURIComponent(lang)}` : `${API_BASE}v1/tools`;
    return handleApiRequest(() => fetch(url, getConfig()), "Failed to get tools");
}

export async function chatApi(options: ChatRequest): Promise<Response> {
    const url = API_BASE + "v1/chat/completions";
    return await fetch(url, postConfig(toChatCompletionBody(options)));
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
        () => fetch(API_BASE + "v1/generations/assistant-draft", postConfig({ prompt_seed: request.prompt_seed })),
        "Failed to generate assistant draft"
    );
}

/** Run the EU AI Act high-risk compliance check for an assistant system prompt. */
export async function checkAssistantComplianceApi(input: ComplianceCheckRequest): Promise<ComplianceCheckResponse> {
    return handleApiRequest(() => fetch(API_BASE + "v1/compliance/check", postConfig(input)), "Failed to run compliance check");
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
