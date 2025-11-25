import { useState, useEffect, useCallback, useMemo } from "react";
import { Model } from "../../api";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
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

const formatCostPerMillion = (costPerToken: number | null, fallbackLabel: string): string => {
    if (costPerToken === null) return fallbackLabel;
    const perMillion = costPerToken * TOKENS_PER_MILLION;
    if (!Number.isFinite(perMillion)) return fallbackLabel;
    const absValue = Math.abs(perMillion);
    const maximumFractionDigits = absValue >= 100 ? 2 : absValue >= 10 ? 3 : absValue >= 1 ? 4 : 6;
    const minimumFractionDigits = absValue >= 1 ? 2 : 4;
    return `${perMillion.toLocaleString(undefined, {
        minimumFractionDigits,
        maximumFractionDigits
    })}$ / 1M Token`;
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
            try {
                localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, modelName);
            } catch {
                /* ignore storage errors in environments without localStorage */
            }
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

    return (
        <div>
            <Dialog modalType="alert">
                <DialogTrigger disableButtonEnhancement>
                    <Tooltip content={title} relationship="description" positioning="after">
                        <div className={`${styles.container} ${styles.buttonContainer}`} role="button" tabIndex={0}>
                            <RocketRegular className={styles.iconRightMargin} />
                            <span className={styles.modelName}>{displayName}</span>
                        </div>
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
                                    const knowledgeBadge = knowledgeText ? (
                                        <div className={styles.badgeList}>
                                            <span className={`${styles.badge} ${styles.badgeKnowledge}`}>
                                                {t("components.llmSelector.knowledge")}: {knowledgeText}
                                            </span>
                                        </div>
                                    ) : null;
                                    const descriptionText = item.description && item.description.trim().length > 0 ? item.description : notAvailable;
                                    const inputTokensText =
                                        Number.isFinite(item.max_input_tokens) && item.max_input_tokens != null
                                            ? `${item.max_input_tokens} Token`
                                            : notAvailable;
                                    const outputTokensText =
                                        Number.isFinite(item.max_output_tokens) && item.max_output_tokens != null
                                            ? `${item.max_output_tokens} Token`
                                            : notAvailable;
                                    const inputPriceText = formatCostPerMillion(inputPrice, notAvailable);
                                    const outputPriceText = formatCostPerMillion(outputPrice, notAvailable);

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
                                                    <SectionHeading title="Herkunft" />
                                                    {providerDisplay && <InfoRow label={t("components.llmSelector.provider")} value={providerDisplay} />}
                                                    {locationDisplay ? (
                                                        <InfoRow label={t("components.llmSelector.location")} value={locationDisplay} />
                                                    ) : (
                                                        <div className={`${styles.infoRow} ${styles.locationPlaceholder}`} aria-hidden="true" />
                                                    )}
                                                </div>
                                                <div className={styles.sectionGroup}>
                                                    <SectionHeading title={t("components.llmSelector.context")} />
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
                                    Auswählen
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
