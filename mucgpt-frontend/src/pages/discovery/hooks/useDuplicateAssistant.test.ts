import { describe, expect, it } from "vitest";
import { duplicateConfirmMessageKey } from "./useDuplicateAssistant";

describe("duplicateConfirmMessageKey", () => {
    it("uses the plain message for live assistants and the deleted variant for snapshot sources", () => {
        expect(duplicateConfirmMessageKey({ id: "assistant-1", title: "Assistent" })).toBe("components.community_assistants.duplicate_confirm_message");
        expect(duplicateConfirmMessageKey({ id: "assistant-1", title: "Assistent", isLocalSnapshot: true })).toBe(
            "components.community_assistants.duplicate_confirm_message_deleted"
        );
        expect(duplicateConfirmMessageKey({ id: "assistant-1", title: "Assistent", isLocalSnapshot: true, snapshotReason: "revoked" })).toBe(
            "components.community_assistants.duplicate_confirm_message_revoked"
        );
        expect(duplicateConfirmMessageKey(null)).toBe("components.community_assistants.duplicate_confirm_message");
    });
});
