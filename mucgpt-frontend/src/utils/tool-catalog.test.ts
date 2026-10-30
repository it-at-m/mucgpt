import { describe, expect, it } from "vitest";

import { mergeRestrictedTools } from "./tool-catalog";

describe("mergeRestrictedTools", () => {
    it("adds a configured restricted tool to the public catalog", () => {
        const result = mergeRestrictedTools({ tools: [{ id: "public-tool", name: "Public", description: "", access: "public" }] }, ["restricted-tool"]);

        expect(result.tools.map(tool => tool.id)).toEqual(["public-tool", "restricted-tool"]);
    });

    it("does not duplicate a public catalog tool", () => {
        const result = mergeRestrictedTools({ tools: [{ id: "shared-tool", name: "Shared", description: "", access: "public" }] }, ["shared-tool"]);

        expect(result.tools).toHaveLength(1);
    });

    it("uses restricted-tool metadata when it is available", () => {
        const result = mergeRestrictedTools({ tools: [{ id: "public-tool", name: "Public", description: "", access: "public" }] }, [
            "restricted-tool",
            {
                id: "restricted-tool",
                name: "Confidential document search",
                description: "Search approved confidential documents.",
                access: "restricted"
            }
        ]);

        expect(result.tools).toContainEqual({
            id: "restricted-tool",
            name: "Confidential document search",
            description: "Search approved confidential documents.",
            access: "restricted"
        });
    });
});
