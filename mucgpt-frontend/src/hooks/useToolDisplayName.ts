import { useCallback } from "react";
import { useToolsContext } from "../components/ToolsProvider";

/**
 * Maps a tool call name (the tool id) to the name shown to users.
 * MCP tools use their group from the core config (MCP.SOURCES.<source>.group / tool_groups),
 * since raw MCP tool names like "searxng_web_search" are not meant for users.
 * Local tools keep their localized name. Unknown tools fall back to the id.
 */
export const useToolDisplayName = () => {
    const { tools } = useToolsContext();
    return useCallback(
        (toolId: string) => {
            const tool = tools?.tools.find(candidate => candidate.id === toolId);
            if (!tool) return toolId;
            return (tool.mcp_source && tool.mcp_group) || tool.name;
        },
        [tools]
    );
};
