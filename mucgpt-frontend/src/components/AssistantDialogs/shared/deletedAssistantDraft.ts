import { CommunityAssistantSnapshot } from "../../../api/models";
import { mapCommunitySnapshotToCommunityConfig } from "../../../utils/community-assistant-snapshots";
import { CreateAssistantDraftValues } from "./hooks/useCreateAssistantState";

const DUPLICATE_TITLE_SUFFIX = "[Kopie]";

export const buildDuplicatedAssistantTitle = (title: string): string => {
    const trimmedTitle = title.trim();
    return trimmedTitle ? `${trimmedTitle} ${DUPLICATE_TITLE_SUFFIX}` : title;
};

/**
 * Builds a prefill for the create-assistant mask from a deleted community assistant's snapshot.
 * Features that are no longer available to the user (tools, default model) are omitted, and
 * visibility/department access reset so the copy starts unshared like any new assistant.
 */
export const buildCreateDraftFromDeletedSnapshot = (
    snapshot: CommunityAssistantSnapshot,
    availableToolIds: ReadonlySet<string>,
    availableLLMNames: ReadonlySet<string>
): CreateAssistantDraftValues => {
    const config = mapCommunitySnapshotToCommunityConfig(snapshot);

    return {
        title: buildDuplicatedAssistantTitle(config.title),
        description: config.description,
        systemPrompt: config.system_message,
        creativity: config.creativity,
        defaultModel: config.default_model && availableLLMNames.has(config.default_model) ? config.default_model : undefined,
        tools: (config.tools ?? []).filter(tool => availableToolIds.has(tool.id)),
        followUpActions: config.quick_prompts ?? [],
        starterPrompts: config.examples ?? [],
        hierarchicalAccess: [],
        isVisible: false
    };
};
