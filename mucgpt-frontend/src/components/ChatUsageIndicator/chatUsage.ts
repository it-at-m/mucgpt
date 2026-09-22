export interface ChatUsageSummary {
    totalCost: number;
    lastContextTokens: number;
    maxInputTokens?: number | null;
    warningThresholdPercent?: number;
    criticalThresholdPercent?: number;
}

export type UsageTone = "default" | "warning" | "critical";

// Fallback thresholds (percent of the model's max_input_tokens) used when a model
// doesn't report its own via context_warning_threshold_percent / context_critical_threshold_percent.
export const DEFAULT_CHAT_USAGE_WARNING_THRESHOLD = 75;
export const DEFAULT_CHAT_USAGE_CRITICAL_THRESHOLD = 90;

export const getUsageWarningThreshold = (usage?: ChatUsageSummary): number => usage?.warningThresholdPercent ?? DEFAULT_CHAT_USAGE_WARNING_THRESHOLD;

export const getUsageCriticalThreshold = (usage?: ChatUsageSummary): number => usage?.criticalThresholdPercent ?? DEFAULT_CHAT_USAGE_CRITICAL_THRESHOLD;

export const getUsageTone = (percent: number, usage?: ChatUsageSummary): UsageTone => {
    if (percent >= getUsageCriticalThreshold(usage)) return "critical";
    if (percent >= getUsageWarningThreshold(usage)) return "warning";
    return "default";
};

export const getContextUsagePercent = (usage?: ChatUsageSummary): number | undefined => {
    if (!usage) {
        return undefined;
    }

    const maxInputTokens = usage.maxInputTokens;

    if (typeof maxInputTokens !== "number" || maxInputTokens <= 0) {
        return undefined;
    }

    return Math.min(100, Math.max(0, Math.round((usage.lastContextTokens / maxInputTokens) * 100)));
};
