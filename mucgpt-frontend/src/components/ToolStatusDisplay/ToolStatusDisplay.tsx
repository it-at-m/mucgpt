import React, { useEffect, useRef } from "react";
import { useId, Toaster, useToastController, Toast, ToastTitle, ToastBody, Spinner } from "@fluentui/react-components";
import { CheckmarkCircle20Filled, Info20Filled } from "@fluentui/react-icons";
import { ToolStatus, ToolStreamState } from "../../utils/ToolStreamHandler";
import styles from "./ToolStatusDisplay.module.css";

interface ToolStatusDisplayProps {
    activeTools: ToolStatus[];
}

const ToolStatusDisplay: React.FC<ToolStatusDisplayProps> = ({ activeTools }) => {
    const toasterId = useId("tool-status-toaster");
    const { dispatchToast, dismissAllToasts } = useToastController(toasterId);
    const displayedToolsRef = useRef<Set<string>>(new Set());
    const activeStartedToastsRef = useRef<Map<string, boolean>>(new Map());

    useEffect(() => {
        const now = Date.now();
        const currentDisplayed = displayedToolsRef.current;
        const activeStartedToasts = activeStartedToastsRef.current;

        // Get current tool names and their states
        const currentToolStates = new Map(activeTools.map(tool => [tool.name, tool.state]));

        // Check for tools that have ended - dismiss all toasts and show success
        for (const [toolName, wasStarted] of activeStartedToasts.entries()) {
            const currentState = currentToolStates.get(toolName);
            if (wasStarted && currentState === "ENDED") {
                // Clear all existing toasts and show the completion toast
                dismissAllToasts();
                currentDisplayed.clear();
                activeStartedToasts.clear();
                break;
            }
        }

        // Process each tool status
        activeTools.forEach(tool => {
            const toolKey = `${tool.name}-${tool.state}-${tool.timestamp}`;

            // Skip if we've already shown this exact status
            if (currentDisplayed.has(toolKey)) {
                return;
            }

            // For STARTED tools, show info toast with spinner
            if (tool.state === ToolStreamState.STARTED) {
                dispatchToast(
                    <Toast>
                        <ToastTitle>
                            <div className={`${styles.toastTitleContainer} ${styles.activeToastTitle}`}>
                                <Spinner size="tiny" className={`${styles.spinner} ${styles.spinnerEnhanced}`} />
                                <Info20Filled className={styles.infoIcon} />
                                <span className={styles.toolName}>{tool.name}</span>
                            </div>
                        </ToastTitle>
                        <ToastBody className={styles.toastBody}>
                            <span className={styles.processingMessage}>{tool.message || "Processing..."}</span>
                        </ToastBody>
                    </Toast>,
                    {
                        intent: "info",
                        timeout: -1,
                        pauseOnHover: true
                    }
                );

                currentDisplayed.add(toolKey);
                activeStartedToasts.set(tool.name, true);
            }
            // For ENDED tools, show success toast that auto-dismisses
            else if (tool.state === ToolStreamState.ENDED) {
                dispatchToast(
                    <Toast>
                        <ToastTitle>
                            <div className={`${styles.toastTitleContainer} ${styles.completedToastTitle}`}>
                                <CheckmarkCircle20Filled className={styles.successIcon} />
                                <span className={styles.toolName}>{tool.name}</span>
                                <span className={styles.completeLabel}>✓ Complete</span>
                            </div>
                        </ToastTitle>
                        <ToastBody className={styles.toastBody}>{tool.message || "Task completed successfully"}</ToastBody>
                    </Toast>,
                    {
                        intent: "success",
                        timeout: 4000,
                        pauseOnHover: true
                    }
                );

                currentDisplayed.add(toolKey);
                activeStartedToasts.delete(tool.name);
            }
        });

        // Clean up displayed tools tracking for old entries
        const activeToolKeys = new Set(
            activeTools
                .filter(tool => now - tool.timestamp < 6000) // Keep tracking for 6 seconds
                .map(tool => `${tool.name}-${tool.state}-${tool.timestamp}`)
        );

        // Remove old entries from tracking
        for (const key of currentDisplayed) {
            if (!activeToolKeys.has(key)) {
                currentDisplayed.delete(key);
            }
        }

        // Clean up started toasts tracking for tools no longer active
        const currentToolNames = new Set(activeTools.map(tool => tool.name));
        for (const toolName of activeStartedToasts.keys()) {
            if (!currentToolNames.has(toolName)) {
                activeStartedToasts.delete(toolName);
            }
        }
    }, [activeTools, dispatchToast, dismissAllToasts]);

    return <Toaster toasterId={toasterId} position="bottom-end" className={styles.toolStatusToaster} />;
};

export default ToolStatusDisplay;
