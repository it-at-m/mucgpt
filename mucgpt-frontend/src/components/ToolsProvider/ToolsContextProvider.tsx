import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ToolListResponse } from "../../api/models";
import { getTools } from "../../api/core-client";
import { mapContextToBackendLang } from "../../utils/language-utils";
import { LanguageContext } from "../LanguageSelector/LanguageContextProvider";

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
                setTools(result);
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
