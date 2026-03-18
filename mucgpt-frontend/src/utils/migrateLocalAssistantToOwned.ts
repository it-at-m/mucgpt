import { createCommunityAssistantApi } from "../api/assistant-client";
import { Assistant, AssistantCreateResponse } from "../api/models";
import { AssistantStorageService } from "../service/assistantstorage";

export class LocalAssistantMigrationError extends Error {
    kind: "create_failed" | "cleanup_failed";
    createdAssistantId?: string;

    constructor(message: string, kind: "create_failed" | "cleanup_failed", createdAssistantId?: string) {
        super(message);
        this.name = "LocalAssistantMigrationError";
        this.kind = kind;
        this.createdAssistantId = createdAssistantId;
    }
}

export const migrateLocalAssistantToOwned = async (
    assistant: Assistant,
    assistantId: string,
    assistantStorageService: AssistantStorageService
): Promise<AssistantCreateResponse> => {
    let response: AssistantCreateResponse;
    try {
        response = await createCommunityAssistantApi({
            name: assistant.title,
            description: assistant.description,
            system_prompt: assistant.system_message,
            creativity: assistant.creativity,
            default_model: assistant.default_model,
            tools: assistant.tools || [],
            owner_ids: assistant.owner_ids || [],
            examples: assistant.examples?.map(e => ({ text: e.text, value: e.value })) || [],
            quick_prompts: assistant.quick_prompts || [],
            tags: assistant.tags || [],
            hierarchical_access: assistant.hierarchical_access || [],
            is_visible: false
        });
    } catch (error) {
        throw new LocalAssistantMigrationError(
            error instanceof Error ? error.message : "Failed to create owned assistant from local assistant",
            "create_failed"
        );
    }

    try {
        await assistantStorageService.deleteConfigAndChatsForAssistant(assistantId);
    } catch (error) {
        throw new LocalAssistantMigrationError(
            error instanceof Error ? error.message : "Failed to remove local assistant after creating owned assistant",
            "cleanup_failed",
            response.id
        );
    }

    return response;
};
