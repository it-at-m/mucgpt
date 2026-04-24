import React, { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export interface AppSidebarSlotRenderContext {
    isMobile: boolean;
    requestClose?: () => void;
}

export type AppSidebarContentRenderer = (context: AppSidebarSlotRenderContext) => ReactNode;

interface AppSidebarContentContextValue {
    secondaryContent: AppSidebarContentRenderer | null;
    secondaryTitle: string | null;
    setSecondaryContent: Dispatch<SetStateAction<AppSidebarContentRenderer | null>>;
    setSecondaryTitle: Dispatch<SetStateAction<string | null>>;
}

const noop = () => undefined;

const AppSidebarContentContext = createContext<AppSidebarContentContextValue>({
    secondaryContent: null,
    secondaryTitle: null,
    setSecondaryContent: noop,
    setSecondaryTitle: noop
});

export const AppSidebarContentProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [secondaryContent, setSecondaryContent] = useState<AppSidebarContentRenderer | null>(null);
    const [secondaryTitle, setSecondaryTitle] = useState<string | null>(null);

    const value = useMemo(
        () => ({
            secondaryContent,
            secondaryTitle,
            setSecondaryContent,
            setSecondaryTitle
        }),
        [secondaryContent, secondaryTitle]
    );

    return <AppSidebarContentContext.Provider value={value}>{children}</AppSidebarContentContext.Provider>;
};

export const useAppSidebarContent = () => useContext(AppSidebarContentContext);

interface AppSidebarSlotProps {
    content: ReactNode | AppSidebarContentRenderer | null;
    title?: string | null;
}

export const AppSidebarSlot = ({ content, title = null }: AppSidebarSlotProps) => {
    const { setSecondaryContent, setSecondaryTitle } = useAppSidebarContent();

    useEffect(() => {
        const renderContent = typeof content === "function" ? content : () => content;
        setSecondaryContent(() => (content ? renderContent : null));
        setSecondaryTitle(title);

        return () => {
            setSecondaryContent(() => null);
            setSecondaryTitle(null);
        };
    }, [content, setSecondaryContent, setSecondaryTitle, title]);

    return null;
};
