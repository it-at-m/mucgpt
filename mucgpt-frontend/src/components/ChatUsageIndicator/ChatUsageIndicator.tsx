import { Button, Caption1, Divider, Popover, PopoverSurface, PopoverTrigger, Text } from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./ChatUsageIndicator.module.css";
import { getContextUsagePercent, getUsageTone, type ChatUsageSummary } from "./chatUsage";

export type { ChatUsageSummary } from "./chatUsage";

interface Props {
    usage: ChatUsageSummary;
    autoOpenNotice?: boolean;
    onStartNewChat?: () => void;
    onDismissNotice?: () => void;
}

const HOVER_OPEN_DELAY_MS = 300;

const costLocales: Readonly<Record<string, string>> = {
    BA: "de-DE",
    DE: "de-DE",
    EN: "en-US",
    FR: "fr-FR",
    UK: "uk-UA"
};

export const ChatUsageIndicator = ({ usage, autoOpenNotice = false, onStartNewChat, onDismissNotice }: Props) => {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    // Pinned = kept open by a click or by the auto-open warning notice; only closes on
    // an explicit re-click, "later", or an outside click - hover leave must not close it.
    const [pinned, setPinned] = useState(false);
    const pinnedRef = useRef(pinned);
    pinnedRef.current = pinned;
    const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const clearOpenTimer = useCallback(() => {
        clearTimeout(openTimerRef.current);
    }, []);

    const handlePointerEnter = useCallback(() => {
        if (pinnedRef.current) return;
        clearOpenTimer();
        openTimerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
    }, [clearOpenTimer]);

    const handlePointerLeave = useCallback(() => {
        clearOpenTimer();
        if (pinnedRef.current) return;
        setOpen(false);
    }, [clearOpenTimer]);

    useEffect(() => clearOpenTimer, [clearOpenTimer]);
    const triggerClickRef = useRef(false);

    const handleTriggerClick = useCallback(() => {
        triggerClickRef.current = true;
    }, []);

    const handleOpenChange = useCallback(
        (_event: unknown, data: { open: boolean }) => {
            clearOpenTimer();
            const isTriggerClick = triggerClickRef.current;
            triggerClickRef.current = false;

            if (isTriggerClick && !data.open && !pinnedRef.current) {
                setPinned(true);
                setOpen(true);
                return;
            }
            setPinned(data.open && isTriggerClick);
            setOpen(data.open);
            if (!data.open && autoOpenNotice) {
                onDismissNotice?.();
            }
        },
        [autoOpenNotice, clearOpenTimer, onDismissNotice]
    );

    const maxInputTokens = usage.maxInputTokens;
    const contextPercent = useMemo(() => getContextUsagePercent(usage), [usage]);
    const usageTone = contextPercent === undefined ? "default" : getUsageTone(contextPercent, usage);
    const isFull = contextPercent === 100;

    useEffect(() => {
        if (autoOpenNotice) {
            setPinned(true);
            setOpen(true);
        }
    }, [autoOpenNotice]);

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
    const showsNudgeActions = autoOpenNotice && Boolean(onStartNewChat);
    const explanationDetail = isFull
        ? t("chat.usage_full_warning_detail")
        : showsNudgeActions && usageTone === "warning"
          ? t("chat.usage_nudge_warning_detail")
          : usageTone === "critical" || usageTone === "warning"
            ? t(`chat.usage_help_context_${usageTone}_detail`)
            : t("chat.usage_help_context");

    const handleStartNewChat = () => {
        setPinned(false);
        setOpen(false);
        onStartNewChat?.();
    };

    const handleLater = () => {
        setPinned(false);
        setOpen(false);
        onDismissNotice?.();
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange} positioning={{ position: "above", align: "center" }} withArrow>
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
                    onClick={handleTriggerClick}
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
                    {autoOpenNotice && (
                        <>
                            <Text weight="semibold" className={styles.nudgeTitle} role="status">
                                {t("chat.usage_nudge_title")}
                            </Text>
                            <Caption1 className={styles.helpExplanation}>{t("chat.usage_nudge_description")}</Caption1>
                        </>
                    )}
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
                    {autoOpenNotice && onStartNewChat && (
                        <div className={styles.nudgeActions}>
                            <Button appearance="primary" size="small" onClick={handleStartNewChat}>
                                {t("chat.usage_start_new_chat")}
                            </Button>
                            <Button appearance="subtle" size="small" onClick={handleLater}>
                                {t("chat.usage_nudge_later")}
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverSurface>
        </Popover>
    );
};
