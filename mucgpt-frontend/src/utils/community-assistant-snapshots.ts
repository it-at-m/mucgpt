import { Assistant, AssistantResponse, AssistantVersionResponse, CommunityAssistantSnapshot } from "../api/models";
import { CREATIVITY_LOW } from "../constants";
import { convertTemperatureToCreativity } from "../service/migration";
import { CommunityAssistantStorageService } from "../service/communityassistantstorage";

const mapVersionCreativity = (version: AssistantVersionResponse): string => {
    return version.creativity || (version.temperature !== undefined ? convertTemperatureToCreativity(version.temperature) : CREATIVITY_LOW);
};

export const mapAssistantVersionToSnapshot = (assistantId: string, version: AssistantVersionResponse): CommunityAssistantSnapshot => ({
    id: assistantId,
    title: version.name,
    description: version.description || "",
    system_message: version.system_prompt,
    creativity: mapVersionCreativity(version),
    version: version.version.toString(),
    default_model: version.default_model,
    examples: version.examples || [],
    quick_prompts: version.quick_prompts || [],
    tags: version.tags || [],
    hierarchical_access: version.hierarchical_access || [],
    tools: version.tools || [],
    is_visible: version.is_visible ?? true
});

export const mapAssistantResponseToSnapshot = (assistant: AssistantResponse): CommunityAssistantSnapshot => {
    return mapAssistantVersionToSnapshot(assistant.id, assistant.latest_version);
};

export const mapAssistantToCommunitySnapshot = (assistant: Assistant): CommunityAssistantSnapshot => ({
    id: assistant.id || "",
    title: assistant.title,
    description: assistant.description || "",
    system_message: assistant.system_message || "",
    creativity: assistant.creativity || CREATIVITY_LOW,
    version: assistant.version || "0",
    default_model: assistant.default_model,
    examples: assistant.examples || [],
    quick_prompts: assistant.quick_prompts || [],
    tags: assistant.tags || [],
    hierarchical_access: assistant.hierarchical_access || [],
    tools: assistant.tools || [],
    is_visible: assistant.is_visible
});

export const mapCommunitySnapshotToAssistant = (snapshot: CommunityAssistantSnapshot): Assistant => ({
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description || "",
    system_message: snapshot.system_message || "",
    publish: true,
    creativity: snapshot.creativity || CREATIVITY_LOW,
    default_model: snapshot.default_model,
    version: snapshot.version || "0",
    examples: snapshot.examples || [],
    quick_prompts: snapshot.quick_prompts || [],
    tags: snapshot.tags || [],
    owner_ids: [],
    tools: snapshot.tools || [],
    hierarchical_access: snapshot.hierarchical_access || [],
    is_visible: snapshot.is_visible ?? true
});

export const upsertCommunityAssistantSnapshot = async (
    communityAssistantStorageService: CommunityAssistantStorageService,
    snapshot: CommunityAssistantSnapshot
): Promise<CommunityAssistantSnapshot> => {
    if (!snapshot.id) {
        throw new Error("Cannot store a community assistant snapshot without an assistant id");
    }

    await communityAssistantStorageService.createAssistantConfig(snapshot);
    return snapshot;
};

export const upsertCommunityAssistantSnapshotFromResponse = async (
    communityAssistantStorageService: CommunityAssistantStorageService,
    assistant: AssistantResponse
): Promise<CommunityAssistantSnapshot> => {
    return upsertCommunityAssistantSnapshot(communityAssistantStorageService, mapAssistantResponseToSnapshot(assistant));
};
