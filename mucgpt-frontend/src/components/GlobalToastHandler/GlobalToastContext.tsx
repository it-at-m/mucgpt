import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ShowToastOptions, ToastDisplayOptions, ToastMessage, UpdateToastOptions } from "./types";

let toastIdCounter = 0;
const createToastId = () => `toast-${++toastIdCounter}`;

interface GlobalToastContextType {
    toasts: ToastMessage[];
    showToast: (options: ShowToastOptions) => string;
    showSuccess: (title: string, message?: string, timeout?: number) => string;
    showError: (title: string, message?: string, timeout?: number) => string;
    showWarning: (title: string, message?: string, timeout?: number) => string;
    showInfo: (title: string, message?: string, timeout?: number) => string;
    showLoadingToast: (title: string, message?: string, options?: ToastDisplayOptions) => string;
    updateToast: (toastId: string, patch: UpdateToastOptions) => void;
    dismissToast: (toastId: string) => void;
}

const GlobalToastContext = createContext<GlobalToastContextType | undefined>(undefined);

interface GlobalToastProviderProps {
    children: ReactNode;
}

export const GlobalToastProvider: React.FC<GlobalToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((options: ShowToastOptions) => {
        const persistent = options.persistent ?? options.type === "loading";
        const newToast: ToastMessage = {
            id: options.id ?? createToastId(),
            type: options.type,
            title: options.title,
            message: options.message,
            timeout: persistent ? -1 : options.timeout,
            dismissible: options.dismissible ?? true,
            showIcon: options.showIcon ?? true,
            persistent
        };

        setToasts(prev => [...prev.filter(toast => toast.id !== newToast.id), newToast]);
        return newToast.id;
    }, []);

    const showSuccess = useCallback(
        (title: string, message?: string, timeout?: number) => showToast({ type: "success", title, message, timeout }),
        [showToast]
    );

    const showError = useCallback((title: string, message?: string, timeout?: number) => showToast({ type: "error", title, message, timeout }), [showToast]);

    const showWarning = useCallback(
        (title: string, message?: string, timeout?: number) => showToast({ type: "warning", title, message, timeout }),
        [showToast]
    );

    const showInfo = useCallback((title: string, message?: string, timeout?: number) => showToast({ type: "info", title, message, timeout }), [showToast]);

    const showLoadingToast = useCallback(
        (title: string, message?: string, options?: ToastDisplayOptions) =>
            showToast({
                type: "loading",
                title,
                message,
                persistent: options?.persistent ?? true,
                dismissible: options?.dismissible ?? true,
                showIcon: options?.showIcon ?? true,
                timeout: options?.timeout
            }),
        [showToast]
    );

    const updateToast = useCallback((toastId: string, patch: UpdateToastOptions) => {
        setToasts(prev =>
            prev.map(toast => {
                if (toast.id !== toastId) {
                    return toast;
                }

                const nextType = patch.type ?? toast.type;
                const nextPersistent =
                    patch.persistent === undefined && toast.type === "loading" && nextType !== "loading"
                        ? false
                        : (patch.persistent ?? toast.persistent ?? nextType === "loading");
                const explicitTimeout = patch.timeout !== undefined ? patch.timeout : toast.timeout;

                return {
                    ...toast,
                    ...patch,
                    type: nextType,
                    persistent: nextPersistent,
                    timeout: nextPersistent ? -1 : explicitTimeout
                };
            })
        );
    }, []);

    const dismissToast = useCallback((toastId: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== toastId));
    }, []);

    return (
        <GlobalToastContext.Provider value={{ toasts, showToast, showSuccess, showError, showWarning, showInfo, showLoadingToast, updateToast, dismissToast }}>
            {children}
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
