import { getConfig, getHeaders, handleApiRequest, handleRedirect, postConfig, postFormDataConfig, putConfig } from "./fetch-utils";
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
import type { Message } from "@ag-ui/core";
import type { CanvasRevisions } from "../service/canvasStorage";

const PARSE_SERVICE_BASE = "/api/backend/v1/parse";

export const API_BASE = "/api/backend/";

const AG_UI_CHAT_URL = API_BASE + "v1/chat/v2/completions";

/**
 * Flattens the MUCGPT chat history into AG-UI messages. Every message carries
 * a stable unique id (required by the AG-UI schema); the system prompt is the
 * leading system message, followed by alternating user/assistant turns.
 */
function toAgUiMessages(request: ChatRequest): Message[] {
    const messages: Message[] = [];
    let index = 0;
    if (request.system_message) {
        messages.push({ id: `mucgpt-msg-${index++}`, role: "system", content: request.system_message });
    }
    for (const turn of request.history) {
        messages.push({ id: `mucgpt-msg-${index++}`, role: "user", content: turn.user });
        if (turn.assistant !== undefined) {
            messages.push({ id: `mucgpt-msg-${index++}`, role: "assistant", content: turn.assistant });
        }
    }
    return messages;
}

/** MUCGPT-specific settings passed through the native AG-UI run input. */
export type MucgptForwardedProps = {
    mucgpt: Pick<ChatRequest, "model" | "creativity" | "enabled_tools" | "assistant_id" | "persist" | "data_sources" | "canvas" | "document_ids" | "language">;
};

/**
 * MUCGPT-specific run settings for the native AG-UI run input, namespaced
 * under `forwardedProps.mucgpt` (application-specific channel, passed through
 * untouched; the server strips unknown members with a warning). Absent fields
 * are dropped by JSON.stringify, mirroring the omitted-envelope semantics:
 * an omitted `document_ids` means "no document feature" while an explicitly
 * empty list means "detach all previously selected documents".
 */
export function mucgptForwardedProps(request: ChatRequest): MucgptForwardedProps {
    // AG-UI clones this object before making the HTTP request. Normalize it to
    // the JSON API contract so transient UI objects cannot make cloning fail.
    return JSON.parse(
        JSON.stringify({
            mucgpt: {
                model: request.model,
                creativity: request.creativity,
                enabled_tools: request.enabled_tools,
                assistant_id: request.assistant_id,
                persist: request.persist,
                data_sources: request.data_sources,
                canvas: request.canvas,
                document_ids: request.document_ids,
                language: request.language
            }
        })
    ) as MucgptForwardedProps;
}

/**
 * AG-UI client for MUCGPT chat runs. The stock HttpAgent builds the native
 * `RunAgentInput` (threadId, runId, protocolVersion declaration, enforced
 * schema); the run's MUCGPT settings are passed at `runAgent` time via
 * `forwardedProps` (see `mucgptForwardedProps`).
 */
export class MucgptAgUiAgent extends HttpAgent {
    constructor(request: ChatRequest) {
        super({
            url: AG_UI_CHAT_URL,
            threadId: request.conversation_id,
            initialMessages: toAgUiMessages(request),
            headers: Object.fromEntries(getHeaders().entries()),
            fetch: async (url, init) => {
                // The stock requestInit does not carry the gateway semantics:
                // same-origin credentials, manual redirect handling (the
                // gateway answers an expired session with an opaqueredirect).
                const response = await fetch(url, {
                    ...init,
                    mode: "cors",
                    credentials: "same-origin",
                    redirect: "manual"
                });
                handleRedirect(response);
                return response;
            }
        });
    }
}

export async function getTools(lang?: string): Promise<ToolListResponse> {
    const url = lang ? `${API_BASE}v1/tools?lang=${encodeURIComponent(lang)}` : `${API_BASE}v1/tools`;
    return handleApiRequest(() => fetch(url, getConfig()), "Failed to get tools");
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
                    model: options.model.id
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

export interface ChatTitleGenerationRequest {
    conversationId: string;
    query: string;
    answer: string;
    systemMessage: string;
    /** ISO 639 code of the user's interface language; the title must be written in it. */
    language: string;
    /** The chat's current title, when regenerating an existing title. */
    currentTitle?: string;
    /** The completed turn before the current one, when regenerating. */
    previousTurn?: { query: string; answer: string };
}

export async function createChatName(request: ChatTitleGenerationRequest) {
    const url = API_BASE + "v1/generations/chat-title";
    const body = {
        conversation_id: request.conversationId,
        query: request.query,
        answer: request.answer,
        system_message: request.systemMessage,
        language: request.language,
        current_title: request.currentTitle ?? null,
        previous_turns: request.previousTurn ? [request.previousTurn] : null
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
 * (the converters consume the HTML serialization).
 */
export async function exportCanvasApi(markdown: string, html: string, target: ExportTarget): Promise<Blob> {
    const response = await fetch(
        API_BASE + "v1/export",
        postConfig({
            markdown,
            html,
            target
        })
    );
    handleRedirect(response);
    if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
    }
    return await response.blob();
}
