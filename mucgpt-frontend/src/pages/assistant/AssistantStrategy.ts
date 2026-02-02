import { AssistantStorageService } from "../../service/assistantstorage";
import { AssistantUpdateInput, Assistant } from "../../api/models";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import { deleteCommunityAssistantApi, getCommunityAssistantApi, unsubscribeFromAssistantApi, updateCommunityAssistantApi } from "../../api/assistant-client";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { convertTemperatureToCreativity } from "../../service/migration";

export interface AssistantStrategy {
    loadAssistantConfig(assistantId: string, assistantStorageService: AssistantStorageService): Promise<Assistant | undefined>;
    deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void>;
    updateAssistant?(assistantId: string, newAssistant: Assistant): Promise<{ updatedAssistant?: Assistant }>;
    isOwned: boolean;
    canEdit: boolean;
    requiresReloadOnSave?: boolean; // New flag to indicate if page reload is needed after save
}

export class LocalAssistantStrategy implements AssistantStrategy {
    isOwned = false;
    canEdit = true;
    requiresReloadOnSave = false;

    async loadAssistantConfig(assistantId: string, assistantStorageService: AssistantStorageService): Promise<Assistant | undefined> {
        return await assistantStorageService.getAssistantConfig(assistantId);
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await assistantStorageService.deleteConfigAndChatsForAssistant(assistantId);
    }

    async updateAssistant(assistantId: string, newAssistant: Assistant): Promise<{ updatedAssistant?: Assistant }> {
        const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
        await assistantStorageService.setAssistantConfig(assistantId, newAssistant);

        return { updatedAssistant: newAssistant };
    }
}

export class CommunityAssistantStrategy implements AssistantStrategy {
    isOwned = false;
    canEdit = false;
    requiresReloadOnSave = false;
    communityStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        const response = await getCommunityAssistantApi(assistantId);
        const latest = response.latest_version;
        return {
            id: assistantId,
            title: latest.name,
            description: latest.description || "",
            system_message: latest.system_prompt,
            publish: true,
            creativity: latest.creativity || (latest.temperature !== undefined ? convertTemperatureToCreativity(latest.temperature) : "normal"),
            default_model: latest.default_model,
            version: latest.version.toString(),
            examples: latest.examples || [],
            quick_prompts: latest.quick_prompts || [],
            tags: latest.tags || [],
            owner_ids: latest.owner_ids || [],
            tools: latest.tools || [],
            hierarchical_access: latest.hierarchical_access || [],
            is_visible: latest.is_visible !== undefined ? latest.is_visible : true
        };
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await unsubscribeFromAssistantApi(assistantId);
        await assistantStorageService.deleteChatsForAssistant(assistantId);
        await this.communityStorageService.deleteConfigForAssistant(assistantId);
        window.location.href = "/";
    }
}

export class DeletedCommunityAssistantStrategy implements AssistantStrategy {
    isOwned = false;
    canEdit = false;
    requiresReloadOnSave = false;
    communityStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        const response = await this.communityStorageService.getAssistantConfig(assistantId);
        return {
            id: assistantId,
            title: response?.title || "",
            description: response?.description || "",
            system_message: "",
            publish: true,
            creativity: "aus",
            version: "0",
            examples: [],
            quick_prompts: [],
            tags: [],
            owner_ids: [],
            tools: [],
            hierarchical_access: [],
            is_visible: false
        };
    }

    async deleteAssistant(assistantId: string, assistantStorageService: AssistantStorageService): Promise<void> {
        await assistantStorageService.deleteChatsForAssistant(assistantId);
        await this.communityStorageService.deleteConfigForAssistant(assistantId);
        window.location.href = "/";
    }
}

export class OwnedCommunityAssistantStrategy implements AssistantStrategy {
    isOwned = true;
    canEdit = true;
    requiresReloadOnSave = true;

    async loadAssistantConfig(assistantId: string): Promise<Assistant | undefined> {
        const response = await getCommunityAssistantApi(assistantId);
        const latest = response.latest_version;
        return {
            id: assistantId,
            title: latest.name,
            description: latest.description || "",
            system_message: latest.system_prompt,
            publish: true,
            creativity: latest.creativity || (latest.temperature !== undefined ? convertTemperatureToCreativity(latest.temperature) : "normal"),
            default_model: latest.default_model,
            version: latest.version.toString(),
            examples: latest.examples,
            quick_prompts: latest.quick_prompts,
            tags: latest.tags,
            owner_ids: latest.owner_ids,
            hierarchical_access: latest.hierarchical_access || [],
            tools: latest.tools || [],
            is_visible: latest.is_visible !== undefined ? latest.is_visible : true
        };
    }

    async deleteAssistant(assistantId: string): Promise<void> {
        await deleteCommunityAssistantApi(assistantId);
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
