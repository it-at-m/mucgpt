import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ToolApprovalHandler, ToolApprovalRequest, ToolDecisions } from "../utils/toolApproval";

export interface ToolApprovalState {
    requests: ToolApprovalRequest[];
    requestApproval: ToolApprovalHandler;
    submit: (decisions: ToolDecisions) => void;
    cancel: () => void;
}

export const useToolApproval = (): ToolApprovalState => {
    const [requests, setRequests] = useState<ToolApprovalRequest[]>([]);
    const resolveRef = useRef<((decisions: ToolDecisions | null) => void) | undefined>(undefined);

    const settle = useCallback((decisions: ToolDecisions | null) => {
        resolveRef.current?.(decisions);
        resolveRef.current = undefined;
        setRequests([]);
    }, []);

    const requestApproval = useCallback<ToolApprovalHandler>(
        nextRequests =>
            new Promise(resolve => {
                resolveRef.current = resolve;
                setRequests(nextRequests);
            }),
        []
    );

    const cancel = useCallback(() => settle(null), [settle]);

    useEffect(() => cancel, [cancel]);

    return useMemo(() => ({ requests, requestApproval, submit: settle, cancel }), [requests, requestApproval, settle, cancel]);
};
