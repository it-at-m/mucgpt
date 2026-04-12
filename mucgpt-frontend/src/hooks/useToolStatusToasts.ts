import { useEffect, useRef } from "react";
import { useGlobalToastContext } from "../components/GlobalToastHandler/GlobalToastContext";
import { ToolStatus, ToolStreamState } from "../utils/ToolStreamHandler";

const TOOL_SUCCESS_TIMEOUT = 4000;
const MAX_PROCESSED_STATUSES = 200;

export const useToolStatusToasts = (activeTools: ToolStatus[]) => {
    const { showLoadingToast, showToast, updateToast, dismissToast, toasts } = useGlobalToastContext();
    const activeLoadingToastIdsRef = useRef<Map<string, string>>(new Map());
    const processedStatusesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const processedStatuses = processedStatusesRef.current;

        activeTools.forEach(tool => {
            if (!tool.state) {
                return;
            }

            const toolKey = `${tool.name}-${tool.state}-${tool.timestamp}`;
            if (processedStatuses.has(toolKey)) {
                return;
            }

            if (tool.state === ToolStreamState.STARTED) {
                const existingToastId = activeLoadingToastIdsRef.current.get(tool.name);
                if (existingToastId) {
                    updateToast(existingToastId, {
                        type: "loading",
                        title: tool.name,
                        message: tool.message || "Processing...",
                        persistent: true,
                        showIcon: true,
                        dismissible: true
                    });
                } else {
                    const toastId = showLoadingToast(tool.name, tool.message || "Processing...", {
                        persistent: true,
                        showIcon: true,
                        dismissible: true
                    });
                    activeLoadingToastIdsRef.current.set(tool.name, toastId);
                }
            } else if (tool.state === ToolStreamState.ENDED) {
                const existingToastId = activeLoadingToastIdsRef.current.get(tool.name);
                const toastStillExists = existingToastId !== undefined && toasts.some(t => t.id === existingToastId);
                if (toastStillExists && existingToastId) {
                    updateToast(existingToastId, {
                        type: "success",
                        title: tool.name,
                        message: tool.message || "Task completed successfully",
                        persistent: false,
                        timeout: TOOL_SUCCESS_TIMEOUT,
                        showIcon: true,
                        dismissible: true
                    });
                } else {
                    showToast({
                        type: "success",
                        title: tool.name,
                        message: tool.message || "Task completed successfully",
                        timeout: TOOL_SUCCESS_TIMEOUT,
                        showIcon: true,
                        dismissible: true
                    });
                }
                activeLoadingToastIdsRef.current.delete(tool.name);
            }

            if (processedStatuses.size >= MAX_PROCESSED_STATUSES) {
                const oldest = processedStatuses.values().next().value;
                if (oldest !== undefined) {
                    processedStatuses.delete(oldest);
                }
            }
            processedStatuses.add(toolKey);
        });
    }, [activeTools, dismissToast, showLoadingToast, showToast, toasts, updateToast]);

    useEffect(() => {
        if (activeTools.length === 0) {
            for (const toastId of activeLoadingToastIdsRef.current.values()) {
                dismissToast(toastId);
            }
            activeLoadingToastIdsRef.current.clear();
            processedStatusesRef.current.clear();
        }
    }, [activeTools, dismissToast]);

    useEffect(() => {
        return () => {
            for (const toastId of activeLoadingToastIdsRef.current.values()) {
                dismissToast(toastId);
            }
            activeLoadingToastIdsRef.current.clear();
        };
    }, [dismissToast]);
};
