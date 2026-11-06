import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import { STORAGE_KEYS } from "../../../pages/layout/LayoutHelper";
import { AssistantStorageService } from "../../../service/assistantstorage";
import {
    AfterCreateAction,
    clearPendingAfterCreateAction,
    consumePendingAfterCreateAction,
    executeAfterCreateAction,
    setPendingAfterCreateAction
} from "./afterCreateAction";

const action: AfterCreateAction = {
    type: "reattachDeletedAssistantChats",
    sourceAssistantId: "deleted-1",
    expectedDraftTitle: "Verweigert [Kopie]"
};

const readSlot = (): unknown => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.AFTER_CREATE_ACTION);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const stubSessionStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        }
    });
};

describe("afterCreateAction", () => {
    beforeEach(() => {
        stubSessionStorage();
        clearPendingAfterCreateAction();
        vi.restoreAllMocks();
    });

    afterEach(() => vi.unstubAllGlobals());

    it("persists and consumes the action read-once", () => {
        expect(consumePendingAfterCreateAction()).toBeNull();

        expect(setPendingAfterCreateAction(action)).toBe(true);
        expect(readSlot()).toEqual(action);

        expect(consumePendingAfterCreateAction()).toEqual(action);
        expect(consumePendingAfterCreateAction()).toBeNull();
        expect(readSlot()).toBeNull();
    });

    it("keeps a stale action for the next attempt when persistence of a new one fails", () => {
        expect(setPendingAfterCreateAction(action)).toBe(true);
        const missingAction: AfterCreateAction = { ...action, sourceAssistantId: "deleted-2" };
        vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });

        expect(setPendingAfterCreateAction(missingAction)).toBe(false);
        expect(consumePendingAfterCreateAction()).toEqual(action);
    });

    it("executes the re-attach by transferring chats before removing the snapshot", async () => {
        const transfer = vi.spyOn(AssistantStorageService.prototype, "transferChatsToAssistant").mockResolvedValue();
        const deleteSnapshot = vi.spyOn(CommunityAssistantStorageService.prototype, "deleteConfigForAssistant").mockResolvedValue();

        await executeAfterCreateAction(action, "new-1");

        expect(transfer).toHaveBeenCalledWith("deleted-1", "new-1");
        expect(deleteSnapshot).toHaveBeenCalledWith("deleted-1");
        expect(vi.mocked(transfer).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deleteSnapshot).mock.invocationCallOrder[0]);
    });

    it("ignores unknown action types and propagates transfer failures", async () => {
        vi.spyOn(AssistantStorageService.prototype, "transferChatsToAssistant").mockResolvedValue();
        const deleteSnapshot = vi.spyOn(CommunityAssistantStorageService.prototype, "deleteConfigForAssistant").mockResolvedValue();

        await expect(executeAfterCreateAction({ ...action, type: "unknown" } as never, "new-1")).resolves.toBeUndefined();
        expect(deleteSnapshot).not.toHaveBeenCalled();

        const failure = new Error("transfer failed");
        vi.spyOn(AssistantStorageService.prototype, "transferChatsToAssistant").mockRejectedValue(failure);
        vi.mocked(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).mockClear();
        await expect(executeAfterCreateAction(action, "new-1")).rejects.toBe(failure);
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
    });
});
