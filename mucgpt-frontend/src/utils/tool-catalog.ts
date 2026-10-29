import { ToolInfo, ToolListResponse } from "../api/models";

/** Adds assistant-configured restricted tools that are omitted from the public catalog. */
export function mergeRestrictedTools(catalog: ToolListResponse, restrictedTools: (ToolInfo | string)[]): ToolListResponse {
    const catalogToolIds = new Set(catalog.tools.map(tool => tool.id));
    const restrictedToolMap = new Map<string, ToolInfo>();

    restrictedTools.forEach(tool => {
        if (typeof tool === "string") {
            if (!restrictedToolMap.has(tool)) {
                restrictedToolMap.set(tool, {
                    id: tool,
                    name: tool,
                    description: "",
                    access: "restricted"
                });
            }
            return;
        }
        restrictedToolMap.set(tool.id, tool);
    });

    return {
        ...catalog,
        tools: [...catalog.tools, ...Array.from(restrictedToolMap.values()).filter(tool => !catalogToolIds.has(tool.id))]
    };
}
