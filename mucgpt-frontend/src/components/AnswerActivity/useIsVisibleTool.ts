import { useCallback } from "react";

import { useToolsContext } from "../ToolsProvider";

/** Whether a tool call is worth showing as activity; internal agent tools (planning, scratch files) are not. */
export const useIsVisibleTool = () => {
    const { tools } = useToolsContext();
    return useCallback((toolId: string) => !tools?.internal_tool_ids?.includes(toolId), [tools]);
};
