import React, { useEffect, useRef } from "react";
import { useId, Toaster, useToastController, Toast, ToastTitle, ToastBody } from "@fluentui/react-components";
import { CheckmarkCircle20Filled, ErrorCircle20Filled, Info20Filled, Warning20Filled } from "@fluentui/react-icons";
import styles from "./GlobalToastHandler.module.css";

export interface ToastMessage {
    id: string;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message?: string;
    timeout?: number;
    timestamp: number;
}

interface GlobalToastHandlerProps {
    messages: ToastMessage[];
    onMessageDisplayed: (messageId: string) => void;
}

const GlobalToastHandler: React.FC<GlobalToastHandlerProps> = ({ messages, onMessageDisplayed }) => {
    const toasterId = useId("global-toast-handler");
    const { dispatchToast } = useToastController(toasterId);
    const displayedMessagesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const displayedMessages = displayedMessagesRef.current;

        messages.forEach(message => {
            // Skip if we've already shown this message
            if (displayedMessages.has(message.id)) {
                return;
            }

            const getIcon = () => {
                switch (message.type) {
                    case "success":
                        return <CheckmarkCircle20Filled className={styles.successIcon} />;
                    case "error":
                        return <ErrorCircle20Filled className={styles.errorIcon} />;
                    case "warning":
                        return <Warning20Filled className={styles.warningIcon} />;
                    case "info":
                    default:
                        return <Info20Filled className={styles.infoIcon} />;
                }
            };

            const getIntent = () => {
                switch (message.type) {
                    case "success":
                        return "success";
                    case "error":
                        return "error";
                    case "warning":
                        return "warning";
                    case "info":
                    default:
                        return "info";
                }
            };

            dispatchToast(
                <Toast>
                    <ToastTitle>
                        <div className={`${styles.toastTitleContainer} ${styles[`${message.type}ToastTitle`]}`}>
                            {getIcon()}
                            <span className={styles.toastTitle}>{message.title}</span>
                        </div>
                    </ToastTitle>
                    {message.message && <ToastBody className={styles.toastBody}>{message.message}</ToastBody>}
                </Toast>,
                {
                    intent: getIntent(),
                    timeout: message.timeout ?? (message.type === "error" ? 6000 : 3000),
                    pauseOnHover: true
                }
            );

            displayedMessages.add(message.id);
            onMessageDisplayed(message.id);
        });

        // Clean up old messages from tracking
        const activeMessageIds = new Set(messages.map(msg => msg.id));
        for (const messageId of displayedMessages) {
            if (!activeMessageIds.has(messageId)) {
                displayedMessages.delete(messageId);
            }
        }
    }, [messages, dispatchToast, onMessageDisplayed]);

    return <Toaster toasterId={toasterId} position="bottom-end" className={styles.globalToastHandler} />;
};

export default GlobalToastHandler;
