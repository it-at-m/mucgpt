import React, { createContext, useContext, ReactNode } from "react";
import { useGlobalToast } from "../../hooks/useGlobalToast";
import GlobalToastHandler from "./GlobalToastHandler";

interface GlobalToastContextType {
    showSuccess: (title: string, message?: string, timeout?: number) => string;
    showError: (title: string, message?: string, timeout?: number) => string;
    showWarning: (title: string, message?: string, timeout?: number) => string;
    showInfo: (title: string, message?: string, timeout?: number) => string;
    clearAllMessages: () => void;
}

const GlobalToastContext = createContext<GlobalToastContextType | undefined>(undefined);

interface GlobalToastProviderProps {
    children: ReactNode;
}

export const GlobalToastProvider: React.FC<GlobalToastProviderProps> = ({ children }) => {
    const { messages, showSuccess, showError, showWarning, showInfo, removeMessage, clearAllMessages } = useGlobalToast();

    const contextValue: GlobalToastContextType = {
        showSuccess,
        showError,
        showWarning,
        showInfo,
        clearAllMessages
    };

    return (
        <GlobalToastContext.Provider value={contextValue}>
            {children}
            <GlobalToastHandler messages={messages} onMessageDisplayed={removeMessage} />
        </GlobalToastContext.Provider>
    );
};

export const useGlobalToastContext = (): GlobalToastContextType => {
    const context = useContext(GlobalToastContext);
    if (!context) {
        throw new Error("useGlobalToastContext must be used within a GlobalToastProvider");
    }
    return context;
};
