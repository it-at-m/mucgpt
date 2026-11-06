import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ToolListResponse } from "../../api/models";
import { getTools } from "../../api/core-client";
import { mapContextToBackendLang } from "../../utils/language-utils";
import { LanguageContext } from "../LanguageSelector/LanguageContextProvider";
import { CANVAS_TOOL_IDS } from "../../utils/canvasStream";

interface ToolsContextType {
    tools: ToolListResponse | undefined;
    isLoading: boolean;
}

const ToolsContext = createContext<ToolsContextType>({
    tools: undefined,
    isLoading: true
});

export const useToolsContext = () => useContext(ToolsContext);

interface ToolsProviderProps {
    children: ReactNode;
}

// The canvas is a base capability, always active and hidden from user-facing
// tool selection (chat selector and assistant editor alike).
export const ToolsProvider = ({ children }: ToolsProviderProps) => {
    const { language } = useContext(LanguageContext);
    const [tools, setTools] = useState<ToolListResponse | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchTools = async () => {
            setIsLoading(true);
            try {
                const backendLang = mapContextToBackendLang(language);
                const result = await getTools(backendLang);
                setTools({
                    ...result,
                    tools: result.tools.filter(tool => !(CANVAS_TOOL_IDS as readonly string[]).includes(tool.id))
                });
            } catch (error) {
                console.error("Failed to fetch tools:", error);
                setTools({ tools: [] });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTools();
    }, [language]);

    return <ToolsContext.Provider value={{ tools, isLoading }}>{children}</ToolsContext.Provider>;
};
