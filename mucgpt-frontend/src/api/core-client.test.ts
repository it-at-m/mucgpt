// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mucgptForwardedProps, MucgptAgUiAgent } from "./core-client";
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
                data_sources: undefined,
                canvas: undefined,
                document_ids: ["doc-1"],
                language: "German"
            }
        });
        // JSON serialization drops undefined members, preserving the
        // omitted-envelope semantics (e.g. document_ids presence).
        expect(JSON.parse(JSON.stringify(props)).mucgpt).not.toHaveProperty("canvas");
    });

    it("keeps an explicitly empty document_ids list", () => {
        const props = mucgptForwardedProps(chatRequest({ document_ids: [] }));
        expect(JSON.parse(JSON.stringify(props)).mucgpt.document_ids).toEqual([]);
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
