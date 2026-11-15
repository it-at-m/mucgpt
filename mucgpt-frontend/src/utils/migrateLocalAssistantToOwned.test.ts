import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assistant } from "../api/models";
import { createCommunityAssistantApi } from "../api/assistant-client";
import type { AssistantStorageService } from "../service/assistantstorage";
import { LocalAssistantMigrationError, migrateLocalAssistantToOwned } from "./migrateLocalAssistantToOwned";

vi.mock("../api/assistant-client", async importOriginal => {
    const actual = await importOriginal<typeof import("../api/assistant-client")>();
    return { ...actual, createCommunityAssistantApi: vi.fn() };
});

const assistant = {
    id: "local-1",
    title: "Lokal",
    description: "Beschreibung",
    system_message: "System",
    creativity: "medium",
    tools: ["tool-a"],
    examples: [{ text: "t", value: "v" }],
    quick_prompts: [],
    tags: [],
    hierarchical_access: []
} as unknown as Assistant;

const storageService = () =>
    ({
        transferChatsToAssistant: vi.fn().mockResolvedValue(undefined),
        deleteConfigForAssistant: vi.fn().mockResolvedValue(undefined)
    }) as unknown as AssistantStorageService;

const createdResponse = { id: "created-9" };

beforeEach(() => {
    vi.mocked(createCommunityAssistantApi).mockReset();
});

describe("migrateLocalAssistantToOwned", () => {
    it("creates a private owned assistant and moves the local data over", async () => {
        vi.mocked(createCommunityAssistantApi).mockResolvedValue(createdResponse as never);
        const service = storageService();

        await expect(migrateLocalAssistantToOwned(assistant, "local-1", service)).resolves.toEqual(createdResponse);

        expect(createCommunityAssistantApi).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Lokal",
                description: "Beschreibung",
                system_prompt: "System",
                creativity: "medium",
                tools: ["tool-a"],
                examples: [{ text: "t", value: "v" }],
                is_visible: false
            })
        );
        expect(service.transferChatsToAssistant).toHaveBeenCalledWith("local-1", "created-9");
        expect(service.deleteConfigForAssistant).toHaveBeenCalledWith("local-1");
    });

    it("wraps creation failures as create_failed without a created id", async () => {
        vi.mocked(createCommunityAssistantApi).mockRejectedValue(new Error("offline"));
        const service = storageService();

        const error = await migrateLocalAssistantToOwned(assistant, "local-1", service).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(LocalAssistantMigrationError);
        expect(error).toMatchObject({ kind: "create_failed", message: "offline" });
        expect((error as LocalAssistantMigrationError).createdAssistantId).toBeUndefined();
        expect(service.transferChatsToAssistant).not.toHaveBeenCalled();
    });

    it("wraps non-Error throwables from creation with a generic message", async () => {
        vi.mocked(createCommunityAssistantApi).mockRejectedValue("boom");

        await expect(migrateLocalAssistantToOwned(assistant, "local-1", storageService())).rejects.toMatchObject({
            kind: "create_failed",
            message: "Failed to create owned assistant from local assistant"
        });
    });

    it("wraps cleanup failures as cleanup_failed carrying the created assistant id", async () => {
        vi.mocked(createCommunityAssistantApi).mockResolvedValue(createdResponse as never);
        const service = storageService();
        vi.mocked(service.transferChatsToAssistant).mockRejectedValue(new Error("idb full"));

        const error = await migrateLocalAssistantToOwned(assistant, "local-1", service).catch((e: unknown) => e);

        expect(error).toMatchObject({ kind: "cleanup_failed", message: "idb full", createdAssistantId: "created-9" });
        expect(service.deleteConfigForAssistant).not.toHaveBeenCalled();
    });

    it("uses the generic cleanup message for non-Error throwables", async () => {
        vi.mocked(createCommunityAssistantApi).mockResolvedValue(createdResponse as never);
        const service = storageService();
        vi.mocked(service.transferChatsToAssistant).mockRejectedValue(undefined);

        await expect(migrateLocalAssistantToOwned(assistant, "local-1", service)).rejects.toMatchObject({
            kind: "cleanup_failed",
            message: "Failed to remove local assistant after creating owned assistant"
        });
    });
});
