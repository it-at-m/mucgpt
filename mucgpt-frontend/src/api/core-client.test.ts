// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mucgptForwardedProps, MucgptAgUiAgent, putCanvasContentApi } from "./core-client";
import type { ChatRequest } from "./models";

function chatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
    return {
        history: [{ user: "First question", assistant: "First answer" }, { user: "Second question" }],
        shouldStream: true,
        language: "German",
        system_message: "You are MUCGPT.",
        model: "gpt-4o",
        creativity: "medium",
        enabled_tools: ["Vereinfachen"],
        assistant_id: "assistant-1",
        conversation_id: "conv-1",
        persist: false,
        document_ids: ["doc-1"],
        ...overrides
    };
}

/** Builds a minimal (empty) SSE response body. */
function sseBody(): string {
    return "";
}

describe("mucgptForwardedProps", () => {
    it("carries the MUCGPT settings namespaced under mucgpt", () => {
        const props = mucgptForwardedProps(chatRequest());
        expect(props).toEqual({
            mucgpt: {
                model: "gpt-4o",
                creativity: "medium",
                enabled_tools: ["Vereinfachen"],
                assistant_id: "assistant-1",
                persist: false,
                document_ids: ["doc-1"],
                language: "German"
            }
        });
        expect(props.mucgpt).not.toHaveProperty("canvas");
    });

    it("keeps an explicitly empty document_ids list", () => {
        const props = mucgptForwardedProps(chatRequest({ document_ids: [] }));
        expect(JSON.parse(JSON.stringify(props)).mucgpt.document_ids).toEqual([]);
    });

    it("normalizes nested UI-only values to the JSON request contract", () => {
        const props = mucgptForwardedProps(
            chatRequest({
                data_sources: [
                    {
                        title: "Document",
                        content: "Contents",
                        metadata: { transient: (() => undefined) as never }
                    }
                ]
            })
        );

        expect(() => structuredClone(props)).not.toThrow();
        expect(props).toEqual({
            mucgpt: expect.objectContaining({
                data_sources: [{ title: "Document", content: "Contents", metadata: {} }]
            })
        });
    });
});

describe("MucgptAgUiAgent (native RunAgentInput)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends a conforming native run input on the wire", async () => {
        const bodies: Array<Record<string, unknown>> = [];
        vi.stubGlobal(
            "fetch",
            vi.fn(async (_url: unknown, init: RequestInit) => {
                bodies.push(JSON.parse(String(init.body)));
                return new Response(sseBody(), {
                    status: 200,
                    headers: { "Content-Type": "text/event-stream" }
                });
            })
        );

        const agent = new MucgptAgUiAgent(chatRequest());
        await agent.runAgent({ forwardedProps: mucgptForwardedProps(chatRequest()) });

        expect(bodies).toHaveLength(1);
        const body = bodies[0];
        // native identity + negotiation
        expect(body.threadId).toBe("conv-1");
        expect(body.runId).toEqual(expect.any(String));
        expect(body.protocolVersion).toEqual(expect.any(String));
        // messages: system prompt first, then flattened alternating turns,
        // each with a stable unique id (required by the AG-UI schema)
        expect(body.messages).toEqual([
            { id: "mucgpt-msg-0", role: "system", content: "You are MUCGPT." },
            { id: "mucgpt-msg-1", role: "user", content: "First question" },
            { id: "mucgpt-msg-2", role: "assistant", content: "First answer" },
            { id: "mucgpt-msg-3", role: "user", content: "Second question" }
        ]);
        // MUCGPT settings ride in forwardedProps.mucgpt
        expect(body.forwardedProps).toEqual(
            expect.objectContaining({
                mucgpt: expect.objectContaining({
                    model: "gpt-4o",
                    creativity: "medium",
                    enabled_tools: ["Vereinfachen"],
                    assistant_id: "assistant-1",
                    persist: false,
                    document_ids: ["doc-1"],
                    language: "German"
                })
            })
        );
    });
});

describe("putCanvasContentApi", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends the content as JSON and resolves true on the bodiless 204", async () => {
        // The 204 success carries no body, so the JSON-parsing response
        // handler must not be used for it.
        await expect(putCanvasContentApi("conv-1", "# doc")).resolves.toBe(true);

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(init.method).toBe("PUT");
        expect(JSON.parse(String(init.body))).toEqual({ content: "# doc" });
        expect(init.keepalive).toBe(false);
    });

    it("passes keepalive through to the request", async () => {
        await putCanvasContentApi("conv-1", "# doc", true);

        expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
    });

    it("resolves false for the unpersisted conversation (404)", async () => {
        fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));

        await expect(putCanvasContentApi("conv-2", "# doc")).resolves.toBe(false);
    });

    it("rejects on server errors via the standard error handling", async () => {
        fetchMock.mockImplementation(async () => new Response(null, { status: 500, statusText: "Internal Server Error" }));

        await expect(putCanvasContentApi("conv-3", "# doc")).rejects.toThrow("Internal Server Error");
    });

    it("rejects with the detail message from the standard error handling", async () => {
        fetchMock.mockImplementation(
            async () =>
                new Response(JSON.stringify({ detail: "Canvas exceeds the maximum payload size" }), {
                    status: 422,
                    headers: { "Content-Type": "application/json" }
                })
        );

        await expect(putCanvasContentApi("conv-4", "# doc")).rejects.toThrow("Canvas exceeds the maximum payload size");
    });
});
