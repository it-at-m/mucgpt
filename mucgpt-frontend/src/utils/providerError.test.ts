import { describe, expect, it } from "vitest";
import { ChatProviderError, fromAgUiRunError, fromChunk, providerErrorCodeToI18nKey, toChatProviderError } from "./providerError";
import type { ChatCompletionChunk } from "../api/models";

describe("providerError", () => {
    const chunkWith = (error: unknown): ChatCompletionChunk =>
        ({
            id: "x",
            object: "chat.completion.chunk",
            created: 1,
            choices: [{ delta: {}, index: 0, finish_reason: "error" }],
            error
        }) as ChatCompletionChunk;

    describe("providerErrorCodeToI18nKey", () => {
        it("maps known codes to provider keys", () => {
            expect(providerErrorCodeToI18nKey("content_filter")).toBe("common.errors.provider.content_filter");
            expect(providerErrorCodeToI18nKey("server_error")).toBe("common.errors.provider.server_error");
        });

        it("falls back to the generic key for unknown codes", () => {
            expect(providerErrorCodeToI18nKey("brand_new_code")).toBe("common.errors.provider.unknown");
            expect(providerErrorCodeToI18nKey("")).toBe("common.errors.provider.unknown");
        });
    });

    describe("toChatProviderError", () => {
        it("passes ChatProviderError through", () => {
            const error = new ChatProviderError("rate_limited", "detail-text");
            expect(toChatProviderError(error)).toBe(error);
        });

        it("maps structured payloads (chunk.error shape)", () => {
            const error = toChatProviderError({ code: "authentication", detail: "status: 401", status_code: 401 });
            expect(error.code).toBe("authentication");
            expect(error.detail).toBe("status: 401");
            expect(error.statusCode).toBe(401);
        });

        it("wraps plain errors as unknown and keeps their text as detail", () => {
            const error = toChatProviderError(new Error("Failed to fetch"));
            expect(error.code).toBe("unknown");
            expect(error.detail).toBe("Failed to fetch");
            expect(error.message).toBe("Failed to fetch");
        });

        it("falls back to an empty detail for non-string messages", () => {
            const error = toChatProviderError({ message: { body: "not a string" } });
            expect(error.code).toBe("unknown");
            expect(error.detail).toBe("");
            expect(() => error.detail.trim()).not.toThrow();
        });

        it("prefers a string detail and only uses a string message fallback", () => {
            expect(toChatProviderError({ detail: "technical detail", message: { body: true } }).detail).toBe("technical detail");
            expect(toChatProviderError({ detail: { body: true }, message: "technical message" }).detail).toBe("technical message");
        });

        it("uses the HTTP status as a code fallback when the body has no status", () => {
            const error = toChatProviderError({ code: "unknown", detail: "gateway rejected the request" }, 429);
            expect(error.code).toBe("rate_limited");
            expect(error.statusCode).toBe(429);
            expect(error.detail).toContain("gateway");
        });

        it("maps unambiguous gateway statuses only when no explicit code exists", () => {
            expect(toChatProviderError({ detail: "unauthorized" }, 401).code).toBe("authentication");
            expect(toChatProviderError({ detail: "forbidden" }, 403).code).toBe("permission_denied");
            expect(toChatProviderError({ detail: "too many requests" }, 429).code).toBe("rate_limited");
            expect(toChatProviderError({ detail: "validation failed" }, 400).code).toBe("unknown");
        });

        it("keeps an explicit provider code instead of classifying the HTTP status", () => {
            const error = toChatProviderError({ code: "connection_error", detail: "upstream unavailable" }, 429);
            expect(error.code).toBe("connection_error");
        });

        it("lifts a trailing code from HTTP detail phrases", () => {
            const error = toChatProviderError({ detail: "The AI provider is currently rate limiting requests. (rate_limited)" });
            expect(error.code).toBe("rate_limited");
            expect(error.detail).toContain("rate limiting");
        });

        it("ignores a trailing pseudo-code that is not in the taxonomy", () => {
            const error = toChatProviderError({ detail: "Something else happened (42)" });
            expect(error.code).toBe("unknown");
        });
    });

    describe("fromChunk", () => {
        it("uses the structured payload of the error chunk", () => {
            const error = fromChunk(chunkWith({ code: "content_filter", detail: "filtered", status_code: 400 }));
            expect(error.code).toBe("content_filter");
            expect(error.detail).toBe("filtered");
        });

        it("falls back to unknown with the delta content as detail when no payload exists", () => {
            const chunk = {
                id: "x",
                object: "chat.completion.chunk",
                created: 1,
                choices: [{ delta: { content: "legacy error text" }, index: 0, finish_reason: "error" }]
            } as ChatCompletionChunk;
            const error = fromChunk(chunk);
            expect(error.code).toBe("unknown");
            expect(error.detail).toBe("legacy error text");
        });
    });

    describe("fromAgUiRunError", () => {
        it("uses code + message", () => {
            const error = fromAgUiRunError({ message: "exception: openai.X", code: "server_error" });
            expect(error.code).toBe("server_error");
            expect(error.detail).toBe("exception: openai.X");
        });

        it("falls back to unknown for missing/unknown codes", () => {
            expect(fromAgUiRunError({ message: "boom" }).code).toBe("unknown");
            expect(fromAgUiRunError({ message: "boom", code: "nope" }).code).toBe("unknown");
        });
    });
});
