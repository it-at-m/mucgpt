import { getCommunityAssistantApi } from "../api/assistant-client";
import { ApiError } from "../api/fetch-utils";

export interface OrphanedAssistant {
    id: string;
    /** 404 on the assistant API means it no longer exists; other live assistants were merely unsubscribed. */
    kind: "deleted" | "unsubscribed";
    title?: string;
    description?: string;
    lastUsed: number;
}

/** Legacy assistants use numeric ids that the assistant API cannot resolve. */
export const LEGACY_ASSISTANT_ID_PATTERN = /^\d+$/;

/**
 * Classifies assistant ids whose chats still exist locally but that no longer surface
 * through any assistant list. A 404 marks the assistant as deleted; a live response
 * means the user just unsubscribed. Hidden assistants stay suppressed, legacy
 * numeric ids cannot be resolved and are skipped, other failures are skipped
 * rather than guessed.
 */
export const resolveOrphanedAssistantChats = async (ids: string[], lastUsedById: Map<string, number>): Promise<OrphanedAssistant[]> => {
    const resolved: (OrphanedAssistant | null)[] = await Promise.all(
        ids
            .filter(id => !id || !LEGACY_ASSISTANT_ID_PATTERN.test(id))
            .map(async id => {
                try {
                    const response = await getCommunityAssistantApi(id);
                    const version = response.latest_version;
                    if (response.is_visible === false) {
                        return null;
                    }
                    return {
                        id,
                        kind: "unsubscribed" as const,
                        title: version.name || id,
                        description: version.description || "",
                        lastUsed: lastUsedById.get(id) ?? 0
                    };
                } catch (error) {
                    if (error instanceof ApiError && error.status === 404) {
                        return { id, kind: "deleted" as const, lastUsed: lastUsedById.get(id) ?? 0 };
                    }
                    console.error("Failed to resolve assistant for locally kept chats:", id, error);
                    return null;
                }
            })
    );

    return resolved.filter((orphan): orphan is OrphanedAssistant => orphan !== null).sort((a, b) => b.lastUsed - a.lastUsed);
};
