import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type UnifiedHistoryPageContext =
    | {
          kind: "chat";
          activeChatId?: string;
          resetActiveChat?: (chatId: string) => void;
      }
    | {
          kind: "assistant";
          assistantId: string;
          assistantTitle?: string;
          activeChatId?: string;
          resetActiveChat?: (chatId: string) => void;
      }
    | null;

interface UnifiedHistoryContextValue {
    pageContext: UnifiedHistoryPageContext;
    refreshVersion: number;
    setPageContext: (context: UnifiedHistoryPageContext) => void;
    refreshHistory: () => void;
}

const UnifiedHistoryContext = createContext<UnifiedHistoryContextValue | undefined>(undefined);

export const UnifiedHistoryProvider = ({ children }: { children: ReactNode }) => {
    const [pageContext, setPageContext] = useState<UnifiedHistoryPageContext>(null);
    const [refreshVersion, setRefreshVersion] = useState(0);

    const refreshHistory = useCallback(() => {
        setRefreshVersion(version => version + 1);
    }, []);

    const value = useMemo(
        () => ({
            pageContext,
            refreshVersion,
            setPageContext,
            refreshHistory
        }),
        [pageContext, refreshHistory, refreshVersion]
    );

    return <UnifiedHistoryContext.Provider value={value}>{children}</UnifiedHistoryContext.Provider>;
};

export const useUnifiedHistory = () => {
    const value = useContext(UnifiedHistoryContext);
    if (!value) {
        throw new Error("useUnifiedHistory must be used within UnifiedHistoryProvider");
    }

    return value;
};

export const useUnifiedHistoryRegistration = (context: Exclude<UnifiedHistoryPageContext, null>) => {
    const { setPageContext } = useUnifiedHistory();

    useEffect(() => {
        setPageContext(context);
        return () => setPageContext(null);
    }, [context, setPageContext]);
};
