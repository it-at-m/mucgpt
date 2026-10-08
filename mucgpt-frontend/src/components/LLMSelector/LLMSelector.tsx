import { useState, useEffect, useCallback, useMemo } from "react";
import { Model } from "../../api";
import { Checkmark24Filled, Money24Filled, MoneyRegular, ChevronDown16Regular } from "@fluentui/react-icons";
import styles from "./LLMSelector.module.css";
import { Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Button, Tooltip, Card } from "@fluentui/react-components";
import React from "react";
import { useTranslation } from "react-i18next";
import { Button as SubtleButton } from "../../ui/Button";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

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

const formatKnowledgeDate = (value: string | null | undefined, fallbackLabel: string, language: string): string => {
    if (!value) return fallbackLabel;
    const trimmed = value.trim();
    if (!trimmed) return fallbackLabel;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime())) {
            // ISO dates parse as UTC midnight; formatting in UTC keeps "2024-07-01" in July for every user timezone.
            return new Intl.DateTimeFormat(language === "BA" ? "de-DE" : language, {
                month: "long",
                year: "numeric",
                timeZone: "UTC"
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

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    const [selectedModel, setSelectedModel] = useState(defaultLLM);

    const { t, i18n } = useTranslation();

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

    const title = t("components.llmSelector.title");
    const notAvailable = t("components.llmSelector.notAvailable", { defaultValue: "Nicht verfügbar" });
    const knowledgeTooltipText = t("components.llmSelector.knowledge_description");

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
        <Dialog modalType="modal">
            <DialogTrigger disableButtonEnhancement>
                <Tooltip content={title} relationship="description" positioning="below">
                    <SubtleButton appearance="subtle" icon={<ChevronDown16Regular />} iconPosition="after">
                        {displayName}
                    </SubtleButton>
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

                                const knowledgeText = item.knowledge_cut_off?.trim() || "";
                                const knowledgeDisplay = knowledgeText
                                    ? formatKnowledgeDate(knowledgeText, notAvailable, i18n.resolvedLanguage || i18n.language)
                                    : "";
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
                                const shortDescription = item.short_description?.trim();
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
                                                {shortDescription && <p className={styles.shortDescription}>{shortDescription}</p>}
                                                {knowledgeBadge}
                                                <p className={styles.bestForText}>{descriptionText}</p>
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
                                            </div>
                                            <div className={styles.sectionGroup}>
                                                <div className={styles.price} aria-label={`${t("components.llmSelector.price")} rating ${priceRating} / 3`}>
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
    );
};

export const Selectable = (): React.JSX.Element => {
    const [selected1, setSelected1] = React.useState(false);

    return (
        <div className={styles.main}>
            <Card selected={selected1} onSelectionChange={(_, { selected }) => setSelected1(selected)} />
        </div>
    );
};
