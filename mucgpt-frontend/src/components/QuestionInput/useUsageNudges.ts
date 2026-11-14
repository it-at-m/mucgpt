import { useEffect, useRef, useState } from "react";

import type { ChatUsageSummary } from "../ChatUsageIndicator/ChatUsageIndicator";
import { getContextUsagePercent, getUsageCriticalThreshold, getUsageWarningThreshold } from "../ChatUsageIndicator/chatUsage";

interface Options {
    usage?: ChatUsageSummary;
    /** Identifies the conversation; nudges are shown at most once per conversation. */
    conversationKey?: string;
    onStartNewChat?: () => void;
}

/**
 * Suggests starting a new chat as the context fills up: a one-time popover above the warning
 * threshold, then a dismissible message bar above the critical threshold.
 */
export const useUsageNudges = ({ usage, conversationKey, onStartNewChat }: Options) => {
    const [hasShownPopover, setHasShownPopover] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isMessageBarDismissed, setIsMessageBarDismissed] = useState(false);
    const previousConversationKeyRef = useRef(conversationKey);

    const contextPercent = getContextUsagePercent(usage);
    const warningThreshold = getUsageWarningThreshold(usage);
    const criticalThreshold = getUsageCriticalThreshold(usage);
    const hasNudges = Boolean(onStartNewChat && conversationKey && contextPercent !== undefined);
    const isMessageBarVisible = hasNudges && contextPercent !== undefined && contextPercent >= criticalThreshold && !isMessageBarDismissed;

    useEffect(() => {
        const isNewConversation = previousConversationKeyRef.current !== conversationKey;

        if (isNewConversation) {
            previousConversationKeyRef.current = conversationKey;
            setHasShownPopover(false);
            setIsPopoverOpen(false);
            setIsMessageBarDismissed(false);
        }

        if (!hasNudges || contextPercent === undefined) {
            setIsPopoverOpen(false);
            return;
        }

        const isPopoverRange = contextPercent >= warningThreshold && contextPercent < criticalThreshold;
        const alreadyShownForConversation = isNewConversation ? false : hasShownPopover;

        if (isPopoverRange && !alreadyShownForConversation) {
            setHasShownPopover(true);
            setIsPopoverOpen(true);
        } else if (!isPopoverRange) {
            setIsPopoverOpen(false);
        }

        if (contextPercent < criticalThreshold) {
            setIsMessageBarDismissed(false);
        }
    }, [contextPercent, criticalThreshold, hasShownPopover, hasNudges, conversationKey, warningThreshold]);

    return {
        isPopoverOpen,
        closePopover: () => setIsPopoverOpen(false),
        isMessageBarVisible,
        dismissMessageBar: () => setIsMessageBarDismissed(true)
    };
};
