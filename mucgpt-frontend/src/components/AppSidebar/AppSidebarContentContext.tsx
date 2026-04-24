import React, { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

interface AppSidebarContentContextValue {
    secondaryContent: ReactNode | null;
    secondaryTitle: string | null;
    setSecondaryContent: Dispatch<SetStateAction<ReactNode | null>>;
    setSecondaryTitle: Dispatch<SetStateAction<string | null>>;
}

const noop = () => undefined;

const AppSidebarContentContext = createContext<AppSidebarContentContextValue>({
    secondaryContent: null,
    secondaryTitle: null,
    setSecondaryContent: noop as Dispatch<SetStateAction<ReactNode | null>>,
    setSecondaryTitle: noop as Dispatch<SetStateAction<string | null>>
});

export const AppSidebarContentProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [secondaryContent, setSecondaryContent] = useState<ReactNode | null>(null);
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
    content: ReactNode | null;
    title?: string | null;
}

export const AppSidebarSlot = ({ content, title = null }: AppSidebarSlotProps) => {
    const { setSecondaryContent, setSecondaryTitle } = useAppSidebarContent();

    useEffect(() => {
        setSecondaryContent(content);
        setSecondaryTitle(title);

        return () => {
            setSecondaryContent(null);
            setSecondaryTitle(null);
        };
    }, [content, setSecondaryContent, setSecondaryTitle, title]);

    return null;
};
