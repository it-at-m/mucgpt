import type { ChatCompletionChunk, ProviderErrorPayload } from "../api/models";

/** Stable provider error codes (contract with mucgpt-core-service, see
 * `app/api/exception.py`). Part of this list must stay in sync with the backend. */
export const PROVIDER_ERROR_CODES = [
    "content_filter",
    "rate_limited",
    "authentication",
    "permission_denied",
    "model_not_found",
    "context_length_exceeded",
    "request_timeout",
    "connection_error",
    "server_error",
    "unknown"
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

/** Error thrown by the chat transport (SSE / AG-UI) when the assistant run
 * failed. `code` maps to an i18n key, `detail` holds the technical error for
 * the details view. */
export class ChatProviderError extends Error {
    readonly code: ProviderErrorCode;
    readonly detail: string;
    readonly statusCode: number | null;

    constructor(code: ProviderErrorCode, detail: string, message?: string, statusCode?: number | null) {
        super(message ?? code);
        this.name = "ChatProviderError";
        this.code = code;
        this.detail = detail;
        this.statusCode = statusCode ?? null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** Maps a stable error code to its i18n key (`common.errors.provider.<code>`). */
export function providerErrorCodeToI18nKey(code: string): string {
    const normalized = (PROVIDER_ERROR_CODES as readonly string[]).includes(code) ? code : "unknown";
    return `common.errors.provider.${normalized}`;
}

function parsePayload(raw: unknown): ProviderErrorPayload {
    if (isRecord(raw)) {
        const detail = typeof raw.detail === "string" ? raw.detail : typeof raw.message === "string" ? raw.message : "";
        let code = typeof raw.code === "string" ? (raw.code as ProviderErrorCode) : "unknown";
        if (!(PROVIDER_ERROR_CODES as readonly string[]).includes(code)) {
            code = "unknown";
        }
        // Plain-phrase rendering (HTTP detail e.g. "...error occurred. (rate_limited)"):
        // lift the trailing code so the frontend can still localize the message.
        if (code === "unknown") {
            const match = /\(([a-z_]+)\)\s*$/.exec(detail);
            if (match && (PROVIDER_ERROR_CODES as readonly string[]).includes(match[1])) {
                code = match[1] as ProviderErrorCode;
            }
        }
        const status_code = typeof raw.status_code === "number" ? raw.status_code : null;
        return { code, detail, status_code };
    }
    return { code: "unknown", detail: raw === undefined ? "" : String(raw), status_code: null };
}

/** Fills an unknown provider code from unambiguous HTTP gateway statuses. */
function codeFromHttpFallback(code: ProviderErrorCode, status_code: number | null): ProviderErrorCode {
    if (code !== "unknown" || status_code === null) return code;
    if (status_code === 401) return "authentication";
    if (status_code === 403) return "permission_denied";
    if (status_code === 429) return "rate_limited";
    return code;
}

/**
 * Normalizes anything caught in a chat request into a ChatProviderError.
 * - ChatProviderError passes through
 * - structured payloads (chunk.error, RUN_ERROR code/metadata) map to code+detail
 * - plain Errors become `unknown` (full text kept as technical detail)
 * - `httpStatusCode` fills the status when the body has none
 */
export function toChatProviderError(error: unknown, httpStatusCode?: number): ChatProviderError {
    if (error instanceof ChatProviderError) {
        return error;
    }
    const payload = parsePayload(error);
    const statusCode = payload.status_code ?? httpStatusCode ?? null;
    return new ChatProviderError(
        codeFromHttpFallback(payload.code as ProviderErrorCode, statusCode),
        payload.detail,
        error instanceof Error ? error.message : undefined,
        statusCode
    );
}

/** Reads the structured error off a v1 SSE chunk (if any). */
export function fromChunk(chunk: ChatCompletionChunk): ChatProviderError {
    const error = chunk.error;
    if (error) {
        return toChatProviderError(error);
    }
    // Defensive fallback for chunks without a structured payload: keep the
    // content as technical detail, show the generic message.
    const content = chunk.choices[0]?.delta?.content ?? "";
    return new ChatProviderError("unknown", content, "");
}

/** Builds the error from an AG-UI RUN_ERROR event (code + metadata.detail). */
export function fromAgUiRunError(event: { message: string; code?: string | null }): ChatProviderError {
    const code = event.code && (PROVIDER_ERROR_CODES as readonly string[]).includes(event.code) ? (event.code as ProviderErrorCode) : "unknown";
    return new ChatProviderError(code, event.message, event.message);
}
