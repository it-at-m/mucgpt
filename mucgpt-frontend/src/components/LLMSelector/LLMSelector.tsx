import { useState, useEffect, useCallback, useMemo } from "react";
import { Model } from "../../api";
import { RocketRegular, Checkmark24Filled, Money24Filled, MoneyRegular } from "@fluentui/react-icons";
import styles from "./LLMSelector.module.css";
import { Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Button, Tooltip, Card } from "@fluentui/react-components";
import React from "react";
import { InfoRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

const TOKENS_PER_MILLION = 1_000_000;

const parseCostPerToken = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const averageCostPerToken = (input: number | null, output: number | null): number | null => {
    if (input !== null && output !== null) {
        return (input + output) / 2;
    }
    return input ?? output;
};

const formatCostPerMillion = (costPerToken: number | null, fallbackLabel: string, tokenPluralLabel: string): string => {
    if (costPerToken === null) return fallbackLabel;
    const perMillion = costPerToken * TOKENS_PER_MILLION;
    if (!Number.isFinite(perMillion)) return fallbackLabel;
    const absValue = Math.abs(perMillion);
    const maximumFractionDigits = absValue >= 100 ? 2 : absValue >= 10 ? 3 : absValue >= 1 ? 4 : 6;
    const minimumFractionDigits = absValue >= 1 ? 2 : 4;
    return `${perMillion.toLocaleString(undefined, {
        minimumFractionDigits,
        maximumFractionDigits
    })}$ / 1M ${tokenPluralLabel}`;
};

const formatTokenCount = (value: unknown, fallbackLabel: string, tokenLabel: string, tokenPluralLabel: string): string => {
    if (value === null || value === undefined) return fallbackLabel;
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return fallbackLabel;
    const formatted = numeric.toLocaleString(undefined);
    const isPlural = Math.abs(numeric) !== 1;
    return `${formatted} ${isPlural ? tokenPluralLabel : tokenLabel}`;
};

const formatKnowledgeDate = (value: string | null | undefined, fallbackLabel: string): string => {
    if (!value) return fallbackLabel;
    const trimmed = value.trim();
    if (!trimmed) return fallbackLabel;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat(undefined, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }).format(date);
        }
    }
    return trimmed;
};

interface SectionHeadingProps {
    title: React.ReactNode;
    withSpacing?: boolean;
    className?: string;
    stacked?: boolean;
}

const SectionHeading = ({ title, withSpacing = false, className, stacked = true }: SectionHeadingProps) => {
    const classes = [styles.sectionTitle, withSpacing ? styles.sectionTitleSpacing : "", stacked ? styles.sectionTitleStacked : "", className]
        .filter(Boolean)
        .join(" ");
    return <strong className={classes}>{title}</strong>;
};

interface InfoRowProps {
    label: React.ReactNode;
    value: React.ReactNode;
    tooltip?: React.ReactNode;
    className?: string;
    useDefaultSpacing?: boolean;
    showSpacer?: boolean;
}

const InfoRow = ({ label, value, tooltip, className, useDefaultSpacing = true, showSpacer = true }: InfoRowProps) => {
    const containerClass = [useDefaultSpacing ? styles.infoRow : undefined, className].filter(Boolean).join(" ") || undefined;

    return (
        <div className={containerClass}>
            <strong className={styles.inlineLabel}>{label}</strong>
            {tooltip}
            {showSpacer && <span className={styles.inlineSpacer} aria-hidden="true" />}
            {value}
        </div>
    );
};

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    const [selectedModel, setSelectedModel] = useState(defaultLLM);

    const { t } = useTranslation();

    const handleSelectModel = useCallback(
        (modelName: string) => {
            setSelectedModel(modelName);
            onSelectionChange(modelName);
        },
        [onSelectionChange]
    );

    useEffect(() => {
        setSelectedModel(defaultLLM);
    }, [defaultLLM]);

    const displayName = useMemo(() => {
        const parts = selectedModel.split("/");
        return parts[parts.length - 1];
    }, [selectedModel]);

    // compute numeric min/max prices from options once
    const [minPrice, maxPrice] = useMemo(() => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        for (const o of options) {
            const input = parseCostPerToken(o.input_cost_per_token);
            const output = parseCostPerToken(o.output_cost_per_token);
            const price = averageCostPerToken(input, output);

            if (price === null) continue;
            if (price < min) min = price;
            if (price > max) max = price;
        }

        if (min === Number.POSITIVE_INFINITY) {
            // fallback if no valid prices found
            return [0, 0];
        }
        return [min, max];
    }, [options]);

    const [minContextTokens, maxContextTokens] = useMemo(() => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        for (const o of options) {
            const value = Number(o.max_input_tokens ?? NaN);
            if (!Number.isFinite(value)) continue;
            if (value < min) min = value;
            if (value > max) max = value;
        }

        if (min === Number.POSITIVE_INFINITY) {
            return [0, 0];
        }

        return [min, max];
    }, [options]);

    const maxOutputDesc = t("components.llmSelector.maxOutput_description");
    const maxInputDesc = t("components.llmSelector.maxInput_description");
    const inputPriceDesc = t("components.llmSelector.inputPrice__description");
    const outputPriceDesc = t("components.llmSelector.outputPrice_description");
    const title = t("components.llmSelector.title");
    const notAvailable = t("components.llmSelector.notAvailable", { defaultValue: "Nicht verfügbar" });
    const capabilityReasoning = t("components.llmSelector.capability_reasoning", { defaultValue: "Reasoning" });
    const capabilityFunctionCalling = t("components.llmSelector.capability_functionCalling", { defaultValue: "Function calling" });
    const capabilityVision = t("components.llmSelector.capability_vision", { defaultValue: "Vision" });
    const providerLabel = t("components.llmSelector.provider", { defaultValue: "Provider" });
    const regionLabel = t("components.llmSelector.region", { defaultValue: "Region" });
    const tokenLabel = t("components.llmSelector.token", { defaultValue: "Token" });
    const tokenPluralLabel = t("components.llmSelector.tokens", { defaultValue: "Tokens" });
    const knowledgeTooltipText = t("components.llmSelector.knowledge_description");
    const originHeading = t("components.llmSelector.origin", { defaultValue: "Herkunft" });

    // derive numeric rating (1..3) from item.price relative to min/max price
    const getPriceRating = (price?: number | string): number => {
        const p = Number(price ?? NaN);
        if (!Number.isFinite(p)) return 1;
        if (maxPrice === minPrice) {
            // all prices equal -> show full (3) to indicate parity
            return 3;
        }
        const range = maxPrice - minPrice;
        const ratio = (p - minPrice) / range;
        const v = Math.round(ratio * 2) + 1;
        return Math.max(1, Math.min(3, v));
    };

    const getContextRating = (tokens?: number | string | null): number => {
        const tokenCount = Number(tokens ?? NaN);
        if (!Number.isFinite(tokenCount)) return 1;
        if (maxContextTokens === minContextTokens) {
            return maxContextTokens > 0 ? 3 : 1;
        }
        const range = maxContextTokens - minContextTokens;
        const ratio = (tokenCount - minContextTokens) / range;
        const v = Math.round(ratio * 2) + 1;
        return Math.max(1, Math.min(3, v));
    };

    return (
        <div>
            <Dialog modalType="modal">
                <DialogTrigger disableButtonEnhancement>
                    <Tooltip content={title} relationship="description" positioning="after">
                        <button type="button" className={`${styles.container} ${styles.buttonContainer}`}>
                            <RocketRegular className={styles.iconRightMargin} />
                            <span className={styles.modelName}>{displayName}</span>
                        </button>
                    </Tooltip>
                </DialogTrigger>

                <DialogSurface className={styles.dialogSurface}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogContent>
                            <div className={styles.main}>
                                {options.map((item: Model) => {
                                    // compute a single numeric price for this model from input/output prices
                                    const inputPrice = parseCostPerToken(item.input_cost_per_token);
                                    const outputPrice = parseCostPerToken(item.output_cost_per_token);
                                    const priceVal = averageCostPerToken(inputPrice, outputPrice);

                                    const capabilityBadges: { key: string; label: string }[] = [];
                                    if (item.supports_reasoning) capabilityBadges.push({ key: "reasoning", label: capabilityReasoning });
                                    if (item.supports_function_calling) capabilityBadges.push({ key: "function-calling", label: capabilityFunctionCalling });
                                    if (item.supports_vision) capabilityBadges.push({ key: "vision", label: capabilityVision });

                                    const providerMeta: string[] = [];
                                    const providerDisplay = item.litellm_provider?.trim();
                                    const locationDisplay = item.inference_location?.trim();
                                    if (providerDisplay) providerMeta.push(`${providerLabel}: ${providerDisplay}`);
                                    if (locationDisplay) providerMeta.push(`${regionLabel}: ${locationDisplay}`);

                                    const capabilityContent = capabilityBadges.length ? (
                                        <div className={styles.badgeList}>
                                            {capabilityBadges.map(badge => (
                                                <span key={badge.key} className={styles.badge}>
                                                    {badge.label}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null;

                                    const knowledgeText = item.knowledge_cut_off?.trim() || "";
                                    const knowledgeDisplay = knowledgeText ? formatKnowledgeDate(knowledgeText, notAvailable) : "";
                                    const knowledgeBadge = knowledgeText ? (
                                        <Tooltip content={knowledgeTooltipText} relationship="description" positioning="above">
                                            <div className={styles.badgeList}>
                                                <span className={`${styles.badge} ${styles.badgeKnowledge}`}>
                                                    {t("components.llmSelector.knowledge")}: {knowledgeDisplay}
                                                </span>
                                            </div>
                                        </Tooltip>
                                    ) : null;
                                    const descriptionText = item.description && item.description.trim().length > 0 ? item.description : notAvailable;
                                    const inputTokensText = formatTokenCount(item.max_input_tokens, notAvailable, tokenLabel, tokenPluralLabel);
                                    const outputTokensText = formatTokenCount(null, notAvailable, tokenLabel, tokenPluralLabel);
                                    const inputPriceText = formatCostPerMillion(inputPrice, notAvailable, tokenPluralLabel);
                                    const outputPriceText = formatCostPerMillion(outputPrice, notAvailable, tokenPluralLabel);
                                    const contextRating = getContextRating(item.max_input_tokens);

                                    const priceRating = getPriceRating(priceVal ?? undefined);
                                    return (
                                        <Card
                                            className={styles.card}
                                            key={item.llm_name}
                                            selected={selectedModel === item.llm_name}
                                            data-selected={selectedModel === item.llm_name}
                                            onSelectionChange={() => handleSelectModel(item.llm_name)}
                                        >
                                            <div className={styles.cardContent}>
                                                <div className={styles.cardHeader}>
                                                    <h2>{item.llm_name}</h2>
                                                    {capabilityContent && capabilityContent}
                                                    {!capabilityContent && (
                                                        <div className={styles.badgeList}>
                                                            <span className={styles.badge}>{notAvailable}</span>
                                                        </div>
                                                    )}
                                                    {knowledgeBadge}
                                                    <p className={styles.bestForText}>{descriptionText}</p>
                                                </div>

                                                <div className={styles.sectionGroup}>
                                                    <SectionHeading title={originHeading} />
                                                    {providerDisplay && <InfoRow label={t("components.llmSelector.provider")} value={providerDisplay} />}
                                                    {locationDisplay ? (
                                                        <InfoRow label={t("components.llmSelector.location")} value={locationDisplay} />
                                                    ) : (
                                                        <div className={`${styles.infoRow} ${styles.locationPlaceholder}`} aria-hidden="true" />
                                                    )}
                                                </div>
                                                <div className={styles.sectionGroup}>
                                                    <div className={styles.contextHeadingRow}>
                                                        <SectionHeading title={t("components.llmSelector.context")} stacked={false} />
                                                        <div
                                                            className={styles.contextMeter}
                                                            aria-label={`${t("components.llmSelector.context")} rating ${contextRating} / 3`}
                                                        >
                                                            {Array.from({ length: 3 }).map((_, i) => (
                                                                <span
                                                                    key={i}
                                                                    className={`${styles.contextBar} ${i < contextRating ? styles.contextBarActive : ""}`.trim()}
                                                                    aria-hidden="true"
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <InfoRow
                                                        label={t("components.llmSelector.maxInput")}
                                                        value={inputTokensText}
                                                        tooltip={
                                                            <Tooltip content={maxInputDesc} relationship="description" positioning="above">
                                                                <InfoRegular></InfoRegular>
                                                            </Tooltip>
                                                        }
                                                    />
                                                    <InfoRow
                                                        label={t("components.llmSelector.maxOutput")}
                                                        value={outputTokensText}
                                                        tooltip={
                                                            <Tooltip content={maxOutputDesc} relationship="description" positioning="above">
                                                                <InfoRegular></InfoRegular>
                                                            </Tooltip>
                                                        }
                                                    />
                                                </div>
                                                <div className={styles.sectionGroup}>
                                                    <div>
                                                        <div>
                                                            <div className={styles.price} aria-label={`Price ${priceVal ?? ""}`}>
                                                                <SectionHeading title={t("components.llmSelector.price")} withSpacing stacked={false} />
                                                                {Array.from({ length: 3 }).map((_, i) => {
                                                                    const active = i < priceRating;
                                                                    const cls = active ? `${styles.money} ${styles.moneyActive}` : styles.money;
                                                                    return active ? (
                                                                        <Money24Filled key={i} className={cls} aria-hidden="true" />
                                                                    ) : (
                                                                        <MoneyRegular key={i} className={cls} aria-hidden="true" />
                                                                    );
                                                                })}
                                                            </div>
                                                            <InfoRow
                                                                label={t("components.llmSelector.inputPrice")}
                                                                value={inputPriceText}
                                                                tooltip={
                                                                    <Tooltip content={inputPriceDesc} relationship="description" positioning="above">
                                                                        <InfoRegular></InfoRegular>
                                                                    </Tooltip>
                                                                }
                                                            />
                                                            <InfoRow
                                                                label={t("components.llmSelector.outputPrice")}
                                                                value={outputPriceText}
                                                                tooltip={
                                                                    <Tooltip content={outputPriceDesc} relationship="description" positioning="above">
                                                                        <InfoRegular></InfoRegular>
                                                                    </Tooltip>
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </DialogContent>

                        <DialogActions className={styles.dialogActions}>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="primary" size="medium" onClick={() => handleSelectModel(selectedModel)} className={styles.acceptButton}>
                                    <Checkmark24Filled className={styles.checkIcon} />
                                    {t("components.llmSelector.selectButton", { defaultValue: "Auswählen" })}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};

export const Selectable = (): JSX.Element => {
    const [selected1, setSelected1] = React.useState(false);

    return (
        <div className={styles.main}>
            <Card selected={selected1} onSelectionChange={(_, { selected }) => setSelected1(selected)} />
        </div>
    );
};
