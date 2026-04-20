import React, { useEffect, useRef } from "react";
import { useId, Toaster, useToastController, Toast, ToastTitle, ToastBody, ToastTrigger, Button, Spinner } from "@fluentui/react-components";
import type { ToastIntent } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useGlobalToastContext } from "./GlobalToastContext";
import { DEFAULT_TOAST_TIMEOUT, ToastMessage, ToastType } from "./types";
import styles from "./GlobalToastHandler.module.css";

const getIntent = (type: ToastType): ToastIntent => {
    switch (type) {
        case "success":
            return "success";
        case "error":
            return "error";
        case "warning":
            return "warning";
        case "loading":
        case "info":
        default:
            return "info";
    }
};

const getTypeClass = (type: ToastType) => {
    switch (type) {
        case "success":
            return styles.successToast;
        case "error":
            return styles.errorToast;
        case "warning":
            return styles.warningToast;
        case "loading":
            return styles.loadingToast;
        case "info":
        default:
            return styles.infoToast;
    }
};

const getToastTimeout = (toast: ToastMessage) => {
    if (toast.persistent) {
        return -1;
    }

    if (toast.timeout !== undefined) {
        return toast.timeout;
    }

    return DEFAULT_TOAST_TIMEOUT;
};

const renderToastContent = (toast: ToastMessage, closeLabel: string) => {
    const showIcon = toast.showIcon ?? true;
    const media = !showIcon ? null : toast.type === "loading" ? <Spinner size="extra-small" /> : undefined;

    return (
        <div className={`${styles.toastWrapper} ${getTypeClass(toast.type)}`}>
            <Toast>
                <ToastTitle
                    media={media}
                    action={
                        toast.dismissible !== false ? (
                            <ToastTrigger>
                                <Button appearance="subtle" size="small" icon={<Dismiss20Regular />} aria-label={closeLabel} />
                            </ToastTrigger>
                        ) : undefined
                    }
                >
                    {toast.title}
                </ToastTitle>
                {toast.message && <ToastBody>{toast.message}</ToastBody>}
            </Toast>
        </div>
    );
};

const GlobalToastHandler: React.FC = () => {
    const toasterId = useId("global-toast-handler");
    const { dispatchToast, dismissToast: dismissToastFromController, updateToast } = useToastController(toasterId);
    const renderedToastIdsRef = useRef<Set<string>>(new Set());
    const { toasts, dismissToast } = useGlobalToastContext();
    const { t } = useTranslation();

    useEffect(() => {
        const renderedToastIds = renderedToastIdsRef.current;
        const currentToastIds = new Set(toasts.map(toast => toast.id));
        const closeLabel = t("components.globaltoasthandler.dismiss_aria_label", "Dismiss toast");

        toasts.forEach(toast => {
            const content = renderToastContent(toast, closeLabel);
            const toastOptions = {
                toastId: toast.id,
                intent: getIntent(toast.type),
                timeout: getToastTimeout(toast),
                pauseOnHover: true,
                onStatusChange: (_event: unknown, data: { status?: string }) => {
                    if (data.status === "dismissed") {
                        dismissToast(toast.id);
                    }
                }
            };

            if (renderedToastIds.has(toast.id)) {
                updateToast({
                    ...toastOptions,
                    content
                });
            } else {
                dispatchToast(content, toastOptions);
                renderedToastIds.add(toast.id);
            }
        });

        for (const toastId of renderedToastIds) {
            if (!currentToastIds.has(toastId)) {
                dismissToastFromController(toastId);
                renderedToastIds.delete(toastId);
            }
        }
    }, [toasts, dispatchToast, dismissToast, dismissToastFromController, t, updateToast]);

    return <Toaster toasterId={toasterId} position="bottom-end" className={styles.globalToastHandler} />;
};

export default GlobalToastHandler;
