import { describe, expect, it } from "vitest";

import { mergeRestrictedTools } from "../../../utils/tool-catalog";

describe("mergeRestrictedTools", () => {
    it("adds granted restricted tools to the public catalog", () => {
        const result = mergeRestrictedTools(
            {
                tools: [{ id: "public-tool", name: "Public", description: "", access: "public" }]
            },
            ["granted-tool"]
        );

        expect(result.tools.map(tool => tool.id)).toEqual(["public-tool", "granted-tool"]);
    });
});
