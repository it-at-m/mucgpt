import { ToolInfo } from "../api/models";

/**
 * What users see and select: a whole tool group, or a single tool without a group.
 * The backend enables the entire group as soon as one of its tools is enabled.
 */
export interface ToolEntry {
    id: string;
    name: string;
    description?: string;
    toolIds: string[];
}

export const buildToolEntries = (tools: ToolInfo[]): ToolEntry[] => {
    const entries: ToolEntry[] = [];
    const groupEntries = new Map<string, ToolEntry>();

    for (const tool of tools) {
        if (!tool.mcp_group) {
            entries.push({ id: tool.id, name: tool.name, description: tool.description, toolIds: [tool.id] });
            continue;
        }

        const groupEntry = groupEntries.get(tool.mcp_group);
        if (groupEntry) {
            groupEntry.toolIds.push(tool.id);
        } else {
            const entry = { id: `group:${tool.mcp_group}`, name: tool.mcp_group, toolIds: [tool.id] };
            groupEntries.set(tool.mcp_group, entry);
            entries.push(entry);
        }
    }

    return entries;
};
