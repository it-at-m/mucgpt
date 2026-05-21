import { AssistantStorageService } from "../../service/assistantstorage";
import { AssistantUpdateInput, Assistant } from "../../api/models";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import {
    createCommunityAssistantApi,
    deleteCommunityAssistantApi,
    getCommunityAssistantApi,
    unsubscribeFromAssistantApi,
    updateCommunityAssistantApi
} from "../../api/assistant-client";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import {
    mapAssistantResponseToSnapshot,
    mapCommunitySnapshotToAssistant,
    resolveDeletedCommunityAssistantSnapshot,
    isCompleteCommunityAssistantSnapshot
} from "../../utils/community-assistant-snapshots";

export interface AssistantStrategy {
    loadAssistantConfig(assistantId: string, assistantStorageService: AssistantStorageService): Promise<Assistant | undefined>;
    deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void>;
    updateAssistant?(assistantId: string, newAssistant: Assistant): Promise<{ updatedAssistant?: Assistant }>;
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

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await assistantStorageService.deleteConfigAndChatsForAssistant(assistantId);
    }

    async updateAssistant(assistantId: string, newAssistant: Assistant): Promise<{ updatedAssistant?: Assistant }> {
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
            is_visible: newAssistant.is_visible
        });

        await assistantStorageService.deleteConfigAndChatsForAssistant(assistantId);
        window.location.href = `/#/owned/communityassistant/${response.id}`;

        return {};
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
            throw error;
        }
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await unsubscribeFromAssistantApi(assistantId);
        await assistantStorageService.deleteChatsForAssistant(assistantId);
        await this.communityStorageService.deleteConfigForAssistant(assistantId);
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

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await deleteCommunityAssistantApi(assistantId);
        // Also clean up any local copy that may exist from before the assistant was published
        await assistantStorageService.deleteConfigAndChatsForAssistant(assistantId);
    }

    async updateAssistant(assistantId: string, newAssistant: Assistant): Promise<any> {
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
            is_visible: newAssistant.is_visible
        };

        await updateCommunityAssistantApi(assistantId, updateInput);

        return {};
    }
}
