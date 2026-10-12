import { useCallback, type ReactElement } from "react";
import {
    DocumentSearch16Regular,
    Globe16Regular,
    Lightbulb16Regular,
    PlugConnected16Regular,
    TextEditStyle16Regular,
    Wrench16Regular
} from "@fluentui/react-icons";

import { useToolsContext } from "../ToolsProvider";

const LOCAL_TOOL_ICONS: Record<string, ReactElement> = {
    InternetSearch: <Globe16Regular />,
    Brainstorming: <Lightbulb16Regular />,
    Simplify: <TextEditStyle16Regular />,
    RetrievePMDocs: <DocumentSearch16Regular />
};

/** Maps a tool call name (the tool id) to the small icon shown next to its activity step. */
export const useToolIcon = () => {
    const { tools } = useToolsContext();
    return useCallback(
        (toolId: string): ReactElement => {
            if (LOCAL_TOOL_ICONS[toolId]) return LOCAL_TOOL_ICONS[toolId];
            const tool = tools?.tools.find(candidate => candidate.id === toolId);
            return tool?.mcp_source ? <PlugConnected16Regular /> : <Wrench16Regular />;
        },
        [tools]
    );
};
