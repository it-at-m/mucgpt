import { useCallback } from "react";
import { useToolsContext } from "../components/ToolsProvider";

/** Maps a tool call name (the tool id) to its localized display name, falling back to the id. */
export const useToolDisplayName = () => {
    const { tools } = useToolsContext();
    return useCallback((toolId: string) => tools?.tools.find(tool => tool.id === toolId)?.name ?? toolId, [tools]);
};
