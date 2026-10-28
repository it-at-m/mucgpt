import { describe, expect, it, vi } from "vitest";

import type { AssistantResponse, ToolListResponse } from "../../api/models";
import type { AssistantStorageService } from "../../service/assistantstorage";
import { mergeRestrictedTools } from "../../utils/tool-catalog";

const { getCommunityAssistantApi } = vi.hoisted(() => ({
    getCommunityAssistantApi: vi.fn()
}));

vi.mock("../../api/assistant-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/assistant-client")>()),
    getCommunityAssistantApi
}));

import { AssistantStrategy, CommunityAssistantStrategy, OwnedCommunityAssistantStrategy } from "./AssistantStrategy";

const restrictedToolId = "document-source/read_confidential_document";
const publicToolCatalog: ToolListResponse = {
    tools: [{ id: "public-tool", name: "Public tool", description: "", access: "public" }]
};

const response: AssistantResponse = {
    id: "assistant-id",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    subscriptions_count: 1,
    is_visible: true,
    admin_tags: [],
    granted_tool_ids: [restrictedToolId],
    latest_version: {
        id: "version-id",
        version: 1,
        created_at: "2026-01-01T00:00:00Z",
        name: "Restricted assistant",
        system_prompt: "Use the restricted tool when appropriate.",
        creativity: "medium",
        tools: [{ id: restrictedToolId }],
        is_visible: true
    }
};

const strategies: Array<[string, AssistantStrategy]> = [
    ["community", new CommunityAssistantStrategy()],
    ["owned community", new OwnedCommunityAssistantStrategy()]
];

describe.each(strategies)("%s assistant", (_, strategy) => {
    it("includes its configured restricted tool in the chat catalog", async () => {
        getCommunityAssistantApi.mockResolvedValue(response);

        const assistant = await strategy.loadAssistantConfig("assistant-id", {} as AssistantStorageService);
        const toolIds = mergeRestrictedTools(publicToolCatalog, assistant?.tools?.map(tool => tool.id) ?? []).tools.map(tool => tool.id);

        expect(toolIds).toEqual(["public-tool", restrictedToolId]);
    });
});
