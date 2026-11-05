import { AssistantStorageService } from "../../service/assistantstorage";
import { AssistantUpdateInput, Assistant, AssistantState, ComplianceCheckResponse } from "../../api/models";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import {
    createCommunityAssistantApi,
    deleteCommunityAssistantApi,
    getCommunityAssistantApi,
    unsubscribeFromAssistantApi,
    updateCommunityAssistantApi
} from "../../api/assistant-client";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ApiError } from "../../api/fetch-utils";
import {
    mapAssistantResponseToSnapshot,
    mapCommunitySnapshotToAssistant,
    resolveDeletedCommunityAssistantSnapshot,
    isCompleteCommunityAssistantSnapshot
} from "../../utils/community-assistant-snapshots";

export interface AssistantStrategy {
    loadAssistantConfig(assistantId: string, assistantStorageService: AssistantStorageService): Promise<Assistant | undefined>;
    deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService, keepChats?: boolean): Promise<void>;
    updateAssistant?(
        assistantId: string,
        newAssistant: Assistant
    ): Promise<{ updatedAssistant?: Assistant; persistedComplianceCheckResult?: ComplianceCheckResponse | null; state?: AssistantState }>;
    isOwned: boolean;
    canEdit: boolean;
    requiresReloadOnSave?: boolean; // New flag to indicate if page reload is needed after save
    publishesOnSave?: boolean;
}

export class LocalAssistantStrategy implements AssistantStrategy {
    isOwned = true;
    canEdit = true;
    requiresReloadOnSave = false;
    publishesOnSave = true;

    async loadAssistantConfig(assistantId: string, assistantStorageService: AssistantStorageService): Promise<Assistant | undefined> {
        return await assistantStorageService.getAssistantConfig(assistantId);
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService, keepChats = true): Promise<void> {
        if (keepChats) {
            // The chats are kept: they are converted into normal assistant-less chats so
            // the conversation history (and its last system prompt) survives the deletion.
            await assistantStorageService.convertChatsToNormalChats(assistantId);
        } else {
            await assistantStorageService.deleteChatsForAssistant(assistantId);
        }
        await assistantStorageService.deleteConfigForAssistant(assistantId);
    }

    async updateAssistant(
        assistantId: string,
        newAssistant: Assistant
    ): Promise<{ updatedAssistant?: Assistant; persistedComplianceCheckResult?: ComplianceCheckResponse | null; state?: AssistantState }> {
        const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
        const response = await createCommunityAssistantApi({
            name: newAssistant.title,
            description: newAssistant.description,
            system_prompt: newAssistant.system_message,
            creativity: newAssistant.creativity,
            default_model: newAssistant.default_model,
            tools: newAssistant.tools || [],
            owner_ids: newAssistant.owner_ids || [],
            examples: newAssistant.examples?.map(e => ({ text: e.text, value: e.value })) || [],
            quick_prompts: newAssistant.quick_prompts || [],
            tags: newAssistant.tags || [],
            hierarchical_access: newAssistant.hierarchical_access || [],
            is_visible: newAssistant.is_visible,
            compliance_check_result: newAssistant.compliance_check_result,
            compliance_confirmation: newAssistant.compliance_confirmation
        });

        // Keep chat history: move it to the newly created assistant instead of deleting it.
        await assistantStorageService.transferChatsToAssistant(assistantId, response.id);
        await assistantStorageService.deleteConfigForAssistant(assistantId);
        window.location.href = `/#/owned/communityassistant/${response.id}`;

        return {
            persistedComplianceCheckResult: response.latest_version.compliance_check_result ?? null,
            state: response.latest_version.state
        };
    }
}

export class CommunityAssistantStrategy implements AssistantStrategy {
    isOwned = false;
    canEdit = false;
    requiresReloadOnSave = false;
    communityStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        try {
            const response = await getCommunityAssistantApi(assistantId);
            return mapCommunitySnapshotToAssistant(mapAssistantResponseToSnapshot(response));
        } catch (error) {
            const snapshot = await resolveDeletedCommunityAssistantSnapshot(error, assistantId, this.communityStorageService);
            if (snapshot) {
                const query = window.location.hash.includes("?") ? `?${window.location.hash.split("?")[1]}` : "";
                window.location.href = `/#/deleted/communityassistant/${assistantId}${query}`;
                return mapCommunitySnapshotToAssistant(snapshot);
            }
            // A deleted assistant without a local snapshot still has chat history
            // worth showing; signal the missing config instead of failing the page.
            if (error instanceof ApiError && error.status === 404) {
                return undefined;
            }
            throw error;
        }
    }

    async deleteAssistant(assistantId: string): Promise<void> {
        await unsubscribeFromAssistantApi(assistantId);
    }
}

export class DeletedCommunityAssistantStrategy implements AssistantStrategy {
    isOwned = false;
    canEdit = false;
    requiresReloadOnSave = false;
    communityStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        const response = await this.communityStorageService.getAssistantConfig(assistantId);
        if (!isCompleteCommunityAssistantSnapshot(response)) {
            return undefined;
        }

        return mapCommunitySnapshotToAssistant(response);
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await assistantStorageService.deleteChatsForAssistant(assistantId);
        await this.communityStorageService.deleteConfigForAssistant(assistantId);
    }
}

export class OwnedCommunityAssistantStrategy implements AssistantStrategy {
    isOwned = true;
    canEdit = true;
    requiresReloadOnSave = true;

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        const response = await getCommunityAssistantApi(assistantId);
        const snapshot = mapAssistantResponseToSnapshot(response);
        return {
            ...mapCommunitySnapshotToAssistant(snapshot),
            owner_ids: response.latest_version.owner_ids || []
        };
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService, keepChats = true): Promise<void> {
        if (keepChats) {
            await assistantStorageService.convertChatsToNormalChats(assistantId);
        } else {
            await assistantStorageService.deleteChatsForAssistant(assistantId);
        }
        await deleteCommunityAssistantApi(assistantId);
        // Also clean up any local copy that may exist from before the assistant was published
        await assistantStorageService.deleteConfigForAssistant(assistantId);
    }

    async updateAssistant(
        assistantId: string,
        newAssistant: Assistant
    ): Promise<{ updatedAssistant?: Assistant; persistedComplianceCheckResult?: ComplianceCheckResponse | null; state?: AssistantState }> {
        const updateInput: AssistantUpdateInput = {
            name: newAssistant.title,
            description: newAssistant.description,
            system_prompt: newAssistant.system_message,
            hierarchical_access: newAssistant.hierarchical_access,
            creativity: newAssistant.creativity,
            default_model: newAssistant.default_model,
            tools: newAssistant.tools || [],
            owner_ids: newAssistant.owner_ids,
            examples: newAssistant.examples?.map(e => ({ text: e.text, value: e.value })) || [],
            quick_prompts: newAssistant.quick_prompts || [],
            tags: newAssistant.tags || [],
            version: Number(newAssistant.version),
            is_visible: newAssistant.is_visible,
            compliance_check_result: newAssistant.compliance_check_result,
            compliance_confirmation: newAssistant.compliance_confirmation
        };

        const response = await updateCommunityAssistantApi(assistantId, updateInput);

        return {
            persistedComplianceCheckResult: response.latest_version.compliance_check_result ?? null,
            state: response.latest_version.state
        };
    }
}
