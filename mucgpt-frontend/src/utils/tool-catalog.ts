import { ToolListResponse } from "../api/models";

/** Adds assistant-configured restricted tools that are omitted from the public catalog. */
export function mergeRestrictedTools(catalog: ToolListResponse, restrictedToolIds: string[]): ToolListResponse {
    const catalogToolIds = new Set(catalog.tools.map(tool => tool.id));

    return {
        ...catalog,
        tools: [
            ...catalog.tools,
            ...restrictedToolIds
                .filter(toolId => !catalogToolIds.has(toolId))
                .map(toolId => ({
                    id: toolId,
                    name: toolId,
                    description: "",
                    access: "restricted" as const
                }))
        ]
    };
}
