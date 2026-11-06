import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../../constants";
import { STORAGE_KEYS } from "../../../pages/layout/LayoutHelper";
import { AssistantStorageService } from "../../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import { clearSessionDraft, loadSessionDraft, saveSessionDraft } from "./sessionStorageDraft";

export type AfterCreateAction = {
    type: "reattachDeletedAssistantChats";
    sourceAssistantId: string;
    /**
     * The title the prefill draft was written with. The editor only runs the action
     * when this still matches the draft it is creating, so a mutated or replaced
     * draft (e.g. via the AI-generate flow) can never re-attach the chats to an
     * assistant the source snapshot did not produce.
     */
    expectedDraftTitle: string;
};

export const setPendingAfterCreateAction = (action: AfterCreateAction): boolean => saveSessionDraft(STORAGE_KEYS.AFTER_CREATE_ACTION, action);

export const consumePendingAfterCreateAction = (): AfterCreateAction | null => {
    const action = loadSessionDraft<AfterCreateAction>(STORAGE_KEYS.AFTER_CREATE_ACTION);
    if (action) {
        clearSessionDraft(STORAGE_KEYS.AFTER_CREATE_ACTION);
    }
    return action;
};

export const clearPendingAfterCreateAction = (): void => {
    clearSessionDraft(STORAGE_KEYS.AFTER_CREATE_ACTION);
};

export const executeAfterCreateAction = async (action: AfterCreateAction, newAssistantId: string): Promise<void> => {
    if (action.type !== "reattachDeletedAssistantChats") {
        return;
    }

    const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
    const communityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);
    await assistantStorageService.transferChatsToAssistant(action.sourceAssistantId, newAssistantId);
    await communityAssistantStorageService.deleteConfigForAssistant(action.sourceAssistantId);
};
