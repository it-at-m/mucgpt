import { useState, useCallback } from "react";
import { ToastMessage } from "../components/GlobalToastHandler/GlobalToastHandler";

let toastIdCounter = 0;

export const useGlobalToast = () => {
    const [messages, setMessages] = useState<ToastMessage[]>([]);

    const showToast = useCallback((type: "success" | "error" | "warning" | "info", title: string, message?: string, timeout?: number) => {
        const id = `toast-${++toastIdCounter}`;
        const newMessage: ToastMessage = {
            id,
            type,
            title,
            message,
            timeout,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, newMessage]);
        return id;
    }, []);

    const showSuccess = useCallback(
        (title: string, message?: string, timeout?: number) => {
            return showToast("success", title, message, timeout);
        },
        [showToast]
    );

    const showError = useCallback(
        (title: string, message?: string, timeout?: number) => {
            return showToast("error", title, message, timeout);
        },
        [showToast]
    );

    const showWarning = useCallback(
        (title: string, message?: string, timeout?: number) => {
            return showToast("warning", title, message, timeout);
        },
        [showToast]
    );

    const showInfo = useCallback(
        (title: string, message?: string, timeout?: number) => {
            return showToast("info", title, message, timeout);
        },
        [showToast]
    );

    const removeMessage = useCallback((messageId: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, []);

    const clearAllMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeMessage,
        clearAllMessages
    };
};
