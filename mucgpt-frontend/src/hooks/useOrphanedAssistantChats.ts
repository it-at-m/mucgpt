import { useEffect, useState } from "react";

import { AssistantStorageService } from "../service/assistantstorage";
import { CommunityAssistantStorageService } from "../service/communityassistantstorage";
import { resolveOrphanedAssistantChats, type OrphanedAssistant } from "../utils/orphanedAssistantChats";

interface UseOrphanedAssistantChatsParams {
    assistantStorageService: AssistantStorageService;
    /** Assistant ids that still surface through a list and must not be treated as orphans. */
    excludeIds: Set<string>;
    /** False while the assistant lists are still loading, so orphan resolution waits for a complete picture. */
    enabled?: boolean;
    /** Optional source for the locally stored snapshots of inaccessible assistants. */
    communityAssistantStorageService?: CommunityAssistantStorageService;
}

/**
 * Surfaces assistants whose chats remain in the browser but that no longer appear
 * in any assistant list (deleted, revoked access, or unsubscribed) so their history stays reachable.
 */
export const useOrphanedAssistantChats = ({
    assistantStorageService,
    excludeIds,
    enabled = true,
    communityAssistantStorageService
}: UseOrphanedAssistantChatsParams): OrphanedAssistant[] => {
    const [orphans, setOrphans] = useState<OrphanedAssistant[]>([]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        let cancelled = false;

        const resolve = async () => {
            const records = await assistantStorageService.getChatStorageService().getAll();
            if (cancelled) return;

            const lastUsedById = new Map<string, number>();
            for (const record of records ?? []) {
                if (!record.id || !record.id.startsWith(AssistantStorageService.CHAT_ID) || !record._last_edited) continue;
                // Synced conversations may never have been opened in this browser and carry
                // empty message arrays — they still count as orphaned-chat candidates.
                if (!Array.isArray(record.messages)) continue;

                const withoutPrefix = record.id.substring(AssistantStorageService.CHAT_ID.length);
                const lastUnderscore = withoutPrefix.lastIndexOf("_");
                if (lastUnderscore === -1) continue;

                const assistantId = withoutPrefix.substring(0, lastUnderscore);
                if (!assistantId || excludeIds.has(assistantId)) continue;

                if (record._last_edited > (lastUsedById.get(assistantId) ?? 0)) {
                    lastUsedById.set(assistantId, record._last_edited);
                }
            }

            const resolved = await resolveOrphanedAssistantChats(Array.from(lastUsedById.keys()), lastUsedById, communityAssistantStorageService);
            if (!cancelled) {
                setOrphans(resolved);
            }
        };

        resolve().catch(error => {
            console.error("Failed to resolve orphaned assistant chats:", error);
            if (!cancelled) {
                setOrphans([]);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [assistantStorageService, communityAssistantStorageService, excludeIds, enabled]);

    return orphans;
};
