import { deleteConfig, getConfig, getHeaders, handleApiRequest, handleRedirect, postConfig, postFormDataConfig, putConfig } from "./fetch-utils";
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
import type { CanvasRevisions } from "../service/canvasStorage";

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
        ...(options.persist === false ? { persist: false } : {}),
        ...(options.data_sources ? { data_sources: options.data_sources } : {}),
        ...(options.canvas ? { canvas: options.canvas } : {})
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

    protected override requestInit(): RequestInit {
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

export async function createChatName(conversationId: string, query: string, answer: string, system_message: string) {
    const url = API_BASE + "v1/generations/chat-title";
    const body = {
        conversation_id: conversationId,
        query,
        answer,
        system_message
    };

    const parsedResponse = await handleApiRequest<ChatTitleResponse>(() => fetch(url, postConfig(body)), "Failed to create chat name");

    const generatedName = parsedResponse.title;
    return generatedName || "New Chat";
}

/**
 * Deletes a conversation's server-side state. Best effort: a 404 (the chat never
 * reached the server) counts as deleted, and other failures are only logged so
 * local deletion never depends on the backend.
 */
export async function deleteConversationApi(conversationId: string): Promise<void> {
    try {
        const response = await fetch(API_BASE + "v1/conversations/" + encodeURIComponent(conversationId), deleteConfig());
        handleRedirect(response);
        if (!response.ok && response.status !== 404) {
            console.error(`Failed to delete conversation ${conversationId} on the server: ${response.status}`);
        }
    } catch (error) {
        console.error(`Failed to delete conversation ${conversationId} on the server`, error);
    }
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

export interface CanvasContentResponse {
    content: string;
    updated_at: string;
}

function canvasUrl(conversationId: string, suffix = ""): string {
    return API_BASE + "v1/conversations/" + encodeURIComponent(conversationId) + "/canvas" + suffix;
}

/**
 * Loads the canvas document stored server-side. Returns null when the
 * conversation (or its canvas) does not exist on the server.
 */
export async function getCanvasApi(conversationId: string): Promise<CanvasContentResponse | null> {
    const response = await fetch(canvasUrl(conversationId), getConfig());
    handleRedirect(response);
    if (response.status === 404) {
        return null;
    }
    return handleApiRequest(() => Promise.resolve(response), "Failed to get canvas");
}

/**
 * Loads the client-owned canvas revision rings from the server. Returns null
 * when the conversation (or its canvas revisions) does not exist there.
 */
export async function getCanvasRevisionsApi(conversationId: string): Promise<CanvasRevisions | null> {
    const response = await fetch(canvasUrl(conversationId, "/revisions"), getConfig());
    handleRedirect(response);
    if (response.status === 404) {
        return null;
    }
    return handleApiRequest(() => Promise.resolve(response), "Failed to get canvas revisions");
}

/**
 * Replaces the client-owned canvas revision rings on the server (wholesale
 * overwrite, max 512 KB).
 */
export async function putCanvasRevisionsApi(conversationId: string, revisions: CanvasRevisions): Promise<void> {
    const response = await fetch(canvasUrl(conversationId, "/revisions"), putConfig({ ...revisions }));
    handleRedirect(response);
    if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to save canvas revisions: ${response.status}`);
    }
}

export type ExportTarget = "pdf" | "docx" | "xlsx";

/**
 * Converts the canvas document to a binary file via the backend export endpoint
 *. All three TipTap serializations are sent so each
 * converter picks the lowest-loss input.
 */
export async function exportCanvasApi(markdown: string, html: string, docJson: string, target: ExportTarget): Promise<Blob> {
    const response = await fetch(
        API_BASE + "v1/export",
        postConfig({
            markdown,
            html,
            doc_json: docJson,
            target
        })
    );
    handleRedirect(response);
    if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
    }
    return await response.blob();
}
