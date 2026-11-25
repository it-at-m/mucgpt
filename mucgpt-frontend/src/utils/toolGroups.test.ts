import { expect, it } from "vitest";
import { buildToolEntries } from "./toolGroups";
import type { ToolInfo } from "../api/models";

const tool = (id: string, mcpGroup?: string): ToolInfo => ({ id, name: id, mcp_group: mcpGroup }) as ToolInfo;

it("returns an empty list for an empty tool set", () => {
    expect(buildToolEntries([])).toEqual([]);
});

it("keeps ungrouped tools as single entries", () => {
    expect(buildToolEntries([tool("search"), tool("summarize")])).toEqual([
        { id: "search", name: "search", description: undefined, toolIds: ["search"] },
        { id: "summarize", name: "summarize", description: undefined, toolIds: ["summarize"] }
    ]);
});

it("merges tools of the same MCP group into one entry in encounter order", () => {
    const tools: ToolInfo[] = [
        { id: "docs_search", name: "Docs search", description: "Search docs", mcp_group: "Docs" },
        { id: "standalone", name: "Standalone" },
        { id: "docs_summarize", name: "Docs summarize", mcp_group: "Docs" }
    ] as ToolInfo[];

    expect(buildToolEntries(tools)).toEqual([
        { id: "group:Docs", name: "Docs", toolIds: ["docs_search", "docs_summarize"] },
        { id: "standalone", name: "Standalone", description: undefined, toolIds: ["standalone"] }
    ]);
});

it("creates separate entries per group", () => {
    expect(buildToolEntries([tool("a", "G1"), tool("b", "G2")])).toEqual([
        { id: "group:G1", name: "G1", toolIds: ["a"] },
        { id: "group:G2", name: "G2", toolIds: ["b"] }
    ]);
});
