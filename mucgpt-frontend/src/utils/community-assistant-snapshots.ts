import { Assistant, AssistantCreateInput, AssistantResponse, AssistantVersionResponse, CommunityAssistantSnapshot } from "../api/models";
import { CREATIVITY_LOW } from "../constants";
import { convertTemperatureToCreativity } from "../service/migration";
import { CommunityAssistantStorageService } from "../service/communityassistantstorage";

export const COMMUNITY_ASSISTANT_SNAPSHOT_VERSION = 1;

export type CommunityAssistantConfigData = {
    title: string;
    description: string;
    system_message: string;
    creativity: string;
    default_model?: string;
    examples?: CommunityAssistantSnapshot["examples"];
    quick_prompts?: CommunityAssistantSnapshot["quick_prompts"];
    tags?: string[];
    hierarchical_access?: string[];
    tools?: CommunityAssistantSnapshot["tools"];
    is_visible: boolean;
};

const mapVersionCreativity = (version: AssistantVersionResponse): string => {
    return version.creativity || (version.temperature !== undefined ? convertTemperatureToCreativity(version.temperature) : CREATIVITY_LOW);
};

export const mapAssistantVersionToCommunityConfig = (version: AssistantVersionResponse): CommunityAssistantConfigData => ({
    title: version.name,
    description: version.description || "",
    system_message: version.system_prompt,
    creativity: mapVersionCreativity(version),
    default_model: version.default_model,
    examples: version.examples || [],
    quick_prompts: version.quick_prompts || [],
    tags: version.tags || [],
    hierarchical_access: version.hierarchical_access || [],
    tools: version.tools || [],
    is_visible: version.is_visible ?? true
});

export const mapAssistantResponseToCommunityConfig = (assistant: AssistantResponse): CommunityAssistantConfigData => {
    return mapAssistantVersionToCommunityConfig(assistant.latest_version);
};

export const mapAssistantToCommunityConfig = (assistant: Assistant): CommunityAssistantConfigData => ({
    title: assistant.title,
    description: assistant.description || "",
    system_message: assistant.system_message || "",
    creativity: assistant.creativity || CREATIVITY_LOW,
    default_model: assistant.default_model,
    examples: assistant.examples || [],
    quick_prompts: assistant.quick_prompts || [],
    tags: assistant.tags || [],
    hierarchical_access: assistant.hierarchical_access || [],
    tools: assistant.tools || [],
    is_visible: assistant.is_visible
});

export const mapCommunitySnapshotToCommunityConfig = (snapshot: CommunityAssistantSnapshot): CommunityAssistantConfigData => ({
    title: snapshot.title,
    description: snapshot.description || "",
    system_message: snapshot.system_message || "",
    creativity: snapshot.creativity || CREATIVITY_LOW,
    default_model: snapshot.default_model,
    examples: snapshot.examples || [],
    quick_prompts: snapshot.quick_prompts || [],
    tags: snapshot.tags || [],
    hierarchical_access: snapshot.hierarchical_access || [],
    tools: snapshot.tools || [],
    is_visible: snapshot.is_visible ?? true
});

export const mapCommunityConfigToAssistantCreateInput = (config: CommunityAssistantConfigData): AssistantCreateInput => ({
    name: config.title,
    description: config.description,
    system_prompt: config.system_message,
    creativity: config.creativity,
    default_model: config.default_model,
    tools: config.tools || [],
    owner_ids: [],
    examples: config.examples || [],
    quick_prompts: config.quick_prompts || [],
    tags: config.tags || [],
    hierarchical_access: config.hierarchical_access || [],
    is_visible: config.is_visible
});

export const mapAssistantVersionToSnapshot = (assistantId: string, version: AssistantVersionResponse): CommunityAssistantSnapshot => ({
    snapshot_version: COMMUNITY_ASSISTANT_SNAPSHOT_VERSION,
    id: assistantId,
    version: version.version.toString(),
    ...mapAssistantVersionToCommunityConfig(version)
});

export const mapAssistantResponseToSnapshot = (assistant: AssistantResponse): CommunityAssistantSnapshot => {
    return mapAssistantVersionToSnapshot(assistant.id, assistant.latest_version);
};

export const mapAssistantToCommunitySnapshot = (assistant: Assistant): CommunityAssistantSnapshot => ({
    snapshot_version: COMMUNITY_ASSISTANT_SNAPSHOT_VERSION,
    id: assistant.id || "",
    version: assistant.version || "0",
    ...mapAssistantToCommunityConfig(assistant)
});

export const mapCommunitySnapshotToAssistant = (snapshot: CommunityAssistantSnapshot): Assistant => ({
    id: snapshot.id,
    publish: true,
    version: snapshot.version || "0",
    owner_ids: [],
    ...mapCommunitySnapshotToCommunityConfig(snapshot)
});

export const isCompleteCommunityAssistantSnapshot = (snapshot: unknown): snapshot is CommunityAssistantSnapshot => {
    if (!snapshot || typeof snapshot !== "object") {
        return false;
    }

    const candidate = snapshot as Partial<CommunityAssistantSnapshot>;

    return (
        candidate.snapshot_version === COMMUNITY_ASSISTANT_SNAPSHOT_VERSION &&
        typeof candidate.id === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.description === "string" &&
        typeof candidate.system_message === "string" &&
        typeof candidate.creativity === "string" &&
        typeof candidate.version === "string" &&
        Array.isArray(candidate.examples) &&
        Array.isArray(candidate.quick_prompts) &&
        Array.isArray(candidate.tags) &&
        Array.isArray(candidate.hierarchical_access) &&
        Array.isArray(candidate.tools) &&
        typeof candidate.is_visible === "boolean"
    );
};

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
