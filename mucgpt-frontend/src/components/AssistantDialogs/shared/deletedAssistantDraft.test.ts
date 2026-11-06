import { describe, expect, it } from "vitest";
import { CommunityAssistantSnapshot } from "../../../api/models";
import { buildCreateDraftFromDeletedSnapshot, buildDuplicatedAssistantTitle } from "./deletedAssistantDraft";

const snapshot: CommunityAssistantSnapshot = {
    snapshot_version: 1,
    id: "deleted-1",
    version: "3",
    title: "Risikoanalyse",
    description: "Beschreibung",
    system_message: "System-Prompt",
    creativity: "medium",
    default_model: "gpt-old",
    examples: [{ text: "Beispiel", value: "Beispiel" }],
    quick_prompts: [{ label: "Folgeprompt", prompt: "Folgeprompt" }],
    tags: ["tag"],
    hierarchical_access: ["dep-1"],
    tools: [{ id: "web_search" }, { id: "removed_tool" }],
    is_visible: true
};

describe("buildDuplicatedAssistantTitle", () => {
    it("appends the copy suffix to a non-empty title", () => {
        expect(buildDuplicatedAssistantTitle("Risikoanalyse")).toBe("Risikoanalyse [Kopie]");
    });

    it("keeps an empty title unchanged", () => {
        expect(buildDuplicatedAssistantTitle("   ")).toBe("   ");
    });
});

describe("buildCreateDraftFromDeletedSnapshot", () => {
    it("prefills the draft from the snapshot and resets visibility and access", () => {
        const draft = buildCreateDraftFromDeletedSnapshot(snapshot, new Set(["web_search"]), new Set(["gpt-old"]));

        expect(draft).toEqual({
            title: "Risikoanalyse [Kopie]",
            description: "Beschreibung",
            systemPrompt: "System-Prompt",
            creativity: "medium",
            defaultModel: "gpt-old",
            tools: [{ id: "web_search" }],
            followUpActions: [{ label: "Folgeprompt", prompt: "Folgeprompt" }],
            starterPrompts: [{ text: "Beispiel", value: "Beispiel" }],
            hierarchicalAccess: [],
            isVisible: false
        });
    });

    it("omits tools the user can no longer use and an unavailable default model", () => {
        const draft = buildCreateDraftFromDeletedSnapshot(snapshot, new Set(["other_tool"]), new Set(["gpt-new"]));

        expect(draft.tools).toEqual([]);
        expect(draft.defaultModel).toBeUndefined();
    });
});
