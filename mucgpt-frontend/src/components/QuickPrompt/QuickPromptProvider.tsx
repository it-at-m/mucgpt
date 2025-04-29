// Context.js
import React, { Dispatch, SetStateAction, useContext, useState } from "react";
import { QuickPrompt } from "./QuickPrompt";

interface IQuickPromptProvider {
    quickPrompts: QuickPrompt[];
    setQuickPrompts: Dispatch<SetStateAction<QuickPrompt[]>>;
}

export const QuickPromptContext = React.createContext<IQuickPromptProvider>({ quickPrompts: [], setQuickPrompts: () => {} });

export const QuickPromptProvider = (props: React.PropsWithChildren<{}>) => {
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);

    return <QuickPromptContext.Provider value={{ quickPrompts: quickPrompts, setQuickPrompts: setQuickPrompts }}>{props.children}</QuickPromptContext.Provider>;
};
