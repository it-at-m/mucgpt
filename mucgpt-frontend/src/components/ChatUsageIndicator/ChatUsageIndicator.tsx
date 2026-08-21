import { Button, Caption1, Divider, Popover, PopoverSurface, PopoverTrigger, Text } from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./ChatUsageIndicator.module.css";

export interface ChatUsageSummary {
    totalCost: number;
    lastContextTokens: number;
    maxInputTokens?: number | null;
}

interface Props {
    usage: ChatUsageSummary;
}

type UsageTone = "default" | "warning" | "critical";

const HOVER_OPEN_DELAY_MS = 300;

const costLocales: Readonly<Record<string, string>> = {
    BA: "de-DE",
    DE: "de-DE",
    EN: "en-US",
    FR: "fr-FR",
    UK: "uk-UA"
};

const getUsageTone = (percent: number): UsageTone => {
    if (percent >= 90) return "critical";
    if (percent >= 70) return "warning";
    return "default";
};

export const ChatUsageIndicator = ({ usage }: Props) => {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const clearOpenTimer = useCallback(() => {
        clearTimeout(openTimerRef.current);
    }, []);

    const handlePointerEnter = useCallback(() => {
        clearOpenTimer();
        openTimerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
    }, [clearOpenTimer]);

    const handlePointerLeave = useCallback(() => {
        clearOpenTimer();
        setOpen(false);
    }, [clearOpenTimer]);

    useEffect(() => clearOpenTimer, [clearOpenTimer]);

    const maxInputTokens = usage.maxInputTokens;
    const contextPercent = useMemo(
        () =>
            typeof maxInputTokens === "number" && maxInputTokens > 0
                ? Math.min(100, Math.max(0, Math.round((usage.lastContextTokens / maxInputTokens) * 100)))
                : undefined,
        [maxInputTokens, usage.lastContextTokens]
    );
    const usageTone = contextPercent === undefined ? "default" : getUsageTone(contextPercent);
    const isFull = contextPercent === 100;

    const language = (i18n.resolvedLanguage ?? i18n.language).toUpperCase();
    const tokenFormat = useMemo(() => new Intl.NumberFormat(costLocales[language] ?? "de-DE"), [language]);
    const formattedCost = useMemo(
        () =>
            usage.totalCost > 0
                ? new Intl.NumberFormat(costLocales[language] ?? "de-DE", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4
                  }).format(usage.totalCost)
                : undefined,
        [language, usage.totalCost]
    );

    if (contextPercent === undefined && !formattedCost) return null;

    const usageSummary =
        typeof maxInputTokens === "number" && maxInputTokens > 0
            ? t("chat.usage_context_summary", {
                  used: tokenFormat.format(usage.lastContextTokens),
                  max: tokenFormat.format(maxInputTokens),
                  percent: contextPercent
              })
            : t("chat.usage_context_summary_no_max", { used: tokenFormat.format(usage.lastContextTokens) });

    const explanationLead = isFull
        ? t("chat.usage_full_warning_lead")
        : usageTone === "critical" || usageTone === "warning"
          ? t(`chat.usage_help_context_${usageTone}_lead`)
          : undefined;
    const explanationDetail = isFull
        ? t("chat.usage_full_warning_detail")
        : usageTone === "critical" || usageTone === "warning"
          ? t(`chat.usage_help_context_${usageTone}_detail`)
          : t("chat.usage_help_context");

    return (
        <Popover open={open} onOpenChange={(_event, data) => setOpen(data.open)} positioning={{ position: "above", align: "center" }} withArrow>
            <PopoverTrigger disableButtonEnhancement>
                <Button
                    appearance="transparent"
                    shape="circular"
                    size="small"
                    className={styles.ringButton}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={contextPercent ?? 0}
                    aria-label={isFull ? `${t("chat.usage_context")}. ${explanationLead} ${explanationDetail}` : t("chat.usage_context")}
                    onMouseEnter={handlePointerEnter}
                    onMouseLeave={handlePointerLeave}
                    onFocus={handlePointerEnter}
                    onBlur={handlePointerLeave}
                >
                    <span
                        className={styles.ring}
                        data-tone={usageTone}
                        data-full={isFull}
                        style={{ "--usage-percent": contextPercent ?? 0 } as React.CSSProperties}
                    >
                        {contextPercent !== undefined && <span className={styles.ringValue}>{contextPercent}%</span>}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverSurface className={styles.helpSurface} onMouseEnter={handlePointerEnter} onMouseLeave={handlePointerLeave}>
                <div className={styles.helpContent}>
                    {contextPercent !== undefined && (
                        <Text weight="semibold" className={styles.helpPrimary}>
                            {usageSummary}
                        </Text>
                    )}
                    {formattedCost && <Caption1 className={styles.helpSecondary}>{t("chat.usage_cost", { cost: formattedCost })}</Caption1>}
                    <Divider />
                    <Caption1 className={styles.helpExplanation}>
                        {explanationLead && (
                            <span className={styles.helpExplanationLead} data-tone={usageTone}>
                                {explanationLead}{" "}
                            </span>
                        )}
                        {explanationDetail}
                    </Caption1>
                </div>
            </PopoverSurface>
        </Popover>
    );
};
