import { useEffect, useState } from "react";

import { AssistantStorageService } from "../service/assistantstorage";
import { resolveOrphanedAssistantChats, type OrphanedAssistant } from "../utils/orphanedAssistantChats";

const LEGACY_ASSISTANT_ID_PATTERN = /^\d+$/;

interface UseOrphanedAssistantChatsParams {
    assistantStorageService: AssistantStorageService;
    /** Assistant ids that still surface through a list and must not be treated as orphans. */
    excludeIds: Set<string>;
}

/**
 * Surfaces assistants whose chats remain in the browser but that no longer appear
 * in any assistant list (deleted or unsubscribed) so their history stays reachable.
 */
export const useOrphanedAssistantChats = ({ assistantStorageService, excludeIds }: UseOrphanedAssistantChatsParams): OrphanedAssistant[] => {
    const [orphans, setOrphans] = useState<OrphanedAssistant[]>([]);

    useEffect(() => {
        let cancelled = false;

        const resolve = async () => {
            const records = await assistantStorageService.getChatStorageService().getAll();
            if (cancelled) return;

            const lastUsedById = new Map<string, number>();
            for (const record of records ?? []) {
                if (!record.id || !record.id.startsWith(AssistantStorageService.CHAT_ID) || !record._last_edited) continue;
                if (!Array.isArray(record.messages) || record.messages.length === 0) continue;

                const withoutPrefix = record.id.substring(AssistantStorageService.CHAT_ID.length);
                const lastUnderscore = withoutPrefix.lastIndexOf("_");
                if (lastUnderscore === -1) continue;

                const assistantId = withoutPrefix.substring(0, lastUnderscore);
                if (!assistantId || excludeIds.has(assistantId) || LEGACY_ASSISTANT_ID_PATTERN.test(assistantId)) continue;

                if (record._last_edited > (lastUsedById.get(assistantId) ?? 0)) {
                    lastUsedById.set(assistantId, record._last_edited);
                }
            }

            const resolved = await resolveOrphanedAssistantChats(Array.from(lastUsedById.keys()), lastUsedById);
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
    }, [assistantStorageService, excludeIds]);

    return orphans;
};
