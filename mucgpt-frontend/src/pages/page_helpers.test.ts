import { describe, expect, it, vi } from "vitest";
import type { ChatResponse, Model } from "../api";
import type { StorageService } from "../service/storage";
import type { ChatOptions } from "./chat/Chat";
import { makeApiRequest } from "./page_helpers";

type AgentHandlers = {
    onTextMessageContentEvent: (event: unknown) => void;
    onRunFinishedEvent: (event: unknown) => void;
};

vi.mock("../api/core-client", () => ({
    createChatName: vi.fn(),
    MucgptAgUiAgent: class {
        pendingInterrupts = [];

        subscribe() {
            return { unsubscribe: vi.fn() };
        }

        async runAgent(_input: unknown, handlers: AgentHandlers) {
            handlers.onTextMessageContentEvent({ event: { type: "TEXT_MESSAGE_CONTENT", delta: "AG-UI answer" } });
            handlers.onRunFinishedEvent({ event: { type: "RUN_FINISHED", usage: [] } });
        }
    }
}));
vi.mock("../api/conversations-client", () => ({ deleteConversationApi: vi.fn() }));

describe("AG-UI chat requests", () => {
    it("streams through the AG-UI client without a legacy chat API", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const dispatch = vi.fn();
        const storage = {
            appendMessage: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        } as unknown as StorageService<ChatResponse, ChatOptions>;

        await makeApiRequest(
            [],
            "Question",
            dispatch,
            { id: "test-model", input_cost_per_token: 0, output_cost_per_token: 0 } as Model,
            { current: undefined },
            storage,
            { system: "", creativity: "low" },
            { answer: "", tokens: 0, user_tokens: 0 },
            { current: null },
            { current: false },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            undefined
        );

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "UPDATE_LAST_ANSWER" }));
    });
});
