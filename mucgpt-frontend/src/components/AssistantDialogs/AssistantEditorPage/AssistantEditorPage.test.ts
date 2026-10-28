import { describe, expect, it } from "vitest";

import { filterEditorToolCatalog } from "./AssistantEditorPage";

describe("filterEditorToolCatalog", () => {
    it("adds granted restricted tools to the public catalog", () => {
        const result = filterEditorToolCatalog(
            {
                tools: [{ id: "public-tool", name: "Public", description: "", access: "public" }]
            },
            ["granted-tool"]
        );

        expect(result.tools.map(tool => tool.id)).toEqual(["public-tool", "granted-tool"]);
    });
});
