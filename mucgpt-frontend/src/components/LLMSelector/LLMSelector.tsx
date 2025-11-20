import { useState, useEffect, useCallback, useMemo } from "react";
import { Model } from "../../api";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
import { RocketRegular, Checkmark24Filled, Rocket24Filled, Money24Filled, MoneyRegular } from "@fluentui/react-icons";
import styles from "./LLMSelector.module.css";
import { Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Button, Tooltip, Card, } from "@fluentui/react-components";
import React from "react";
import { InfoRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

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
        const parts = selectedModel.split("-");
        return parts[parts.length - 1].substring(0, 6);
    }, [selectedModel])

    const getSpeedRating = (speed?: string | number): number => {
        if (speed == null) return 1;
        const s = String(speed).trim().toLowerCase();
        if (s.includes("fast")) return 3;
        if (s.includes("medium")) return 2;
        if (s.includes("slow")) return 1;
        const n = Number(s);
        if (isNaN(n) || !isFinite(n)) return 1;
        return Math.max(1, Math.min(3, Math.round(n)));
    };

    // compute numeric min/max prices from options once
    const [minPrice, maxPrice] = useMemo(() => {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        for (const o of options) {
            const input = Number((o as any).input_price ?? NaN);
            const output = Number((o as any).output_price ?? NaN);

            // prefer average when both present, otherwise use the one available
            let p = Number.NaN;
            if (Number.isFinite(input) && Number.isFinite(output)) {
                p = (input + output) / 2;
            } else if (Number.isFinite(input)) {
                p = input;
            } else if (Number.isFinite(output)) {
                p = output;
            }

            if (!Number.isFinite(p)) continue;
            if (p < min) min = p;
            if (p > max) max = p;
        }

        if (min === Number.POSITIVE_INFINITY) {
            // fallback if no valid prices found
            return [0, 0];
        }
        return [min, max];
    }, [options]);

    const maxOutputDesc = t("components.llmSelector.maxOutput_description");
    const maxInputDesc = t("components.llmSelector.maxInput_description");
    const knowledgeDesc = t("components.llmSelector.knowledge_description");
    const inputPriceDesc = t("components.llmSelector.inputPrice__description");
    const outputPriceDesc = t("components.llmSelector.outputPrice_description");
    const title = t("components.llmSelector.title");

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

                <DialogSurface
                    className={styles.dialogSurface}
                >
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogContent>
                            <div className={styles.main}>
                                {options.map((item: Model) => {
                                    const speedRating = getSpeedRating((item as any).speed);

                                    // compute a single numeric price for this model from input/output prices
                                    const inputPrice = Number((item as any).input_price ?? NaN);
                                    const outputPrice = Number((item as any).output_price ?? NaN);
                                    let priceVal = Number.NaN;
                                    if (Number.isFinite(inputPrice) && Number.isFinite(outputPrice)) {
                                        priceVal = (inputPrice + outputPrice) / 2;
                                    } else if (Number.isFinite(inputPrice)) {
                                        priceVal = inputPrice;
                                    } else if (Number.isFinite(outputPrice)) {
                                        priceVal = outputPrice;
                                    }

                                    const priceRating = getPriceRating(priceVal);
                                    return (
                                        <Card
                                            className={styles.card}
                                            key={item.llm_name}
                                            selected={selectedModel === item.llm_name}
                                            data-selected={selectedModel === item.llm_name}
                                            onSelectionChange={() => handleSelectModel(item.llm_name)}
                                        >
                                            <div className={styles.cardContent}>
                                                <div>
                                                    <h2>{item.llm_name}</h2>
                                                    <p>
                                                        <strong>{t("components.llmSelector.bestFor")}</strong>
                                                        <span style={{ marginRight: 8 }}></span>
                                                        {item.description}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p>
                                                        <strong>{t("components.llmSelector.knowledge")}</strong>
                                                        <Tooltip content={knowledgeDesc}
                                                            relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                        </Tooltip>
                                                        <span style={{ marginRight: 8 }}></span>
                                                        {item.knowledge}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p>
                                                        <strong>{t("components.llmSelector.features")}</strong>
                                                        <Tooltip content={"Der letzte Wissensstand mit welchem die KI trainiert wurde. Informationen die nach dem  das Moell nicht wissen"}
                                                            relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                        </Tooltip>
                                                        <span style={{ marginRight: 8 }}></span>
                                                        {item.reasoning}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p>
                                                        <strong>{t("components.llmSelector.maxInput")}</strong>
                                                        <Tooltip content={maxInputDesc}
                                                            relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                        </Tooltip>
                                                        <span style={{ marginRight: 8 }}></span>
                                                        {item.max_input_tokens} Token
                                                    </p>
                                                </div>
                                                <div>
                                                    <p>
                                                        <strong>{t("components.llmSelector.maxOutput")}</strong>
                                                        <Tooltip content={maxOutputDesc}
                                                            relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                        </Tooltip>
                                                        <span style={{ marginRight: 8 }}></span>
                                                        {item.max_output_tokens} Token
                                                    </p>
                                                </div>
                                                <div>
                                                    <div className={styles.speed} aria-label={`Speed ${speedRating}`}>
                                                        <strong style={{ marginRight: 8 }}>{t("components.llmSelector.speed")}</strong>
                                                        {Array.from({ length: 3 }).map((_, i) => {
                                                            const active = i < speedRating;
                                                            const cls = active ? `${styles.rocket} ${styles.rocketActive}` : styles.rocket;
                                                            return active ? (
                                                                <Rocket24Filled key={i} className={cls} aria-hidden="true" />
                                                            ) : (
                                                                <RocketRegular key={i} className={cls} aria-hidden="true" />
                                                            );
                                                        })}
                                                    </div>
                                                    <div>
                                                        <p>
                                                            <strong>{t("components.llmSelector.inputPrice")}</strong>
                                                            <Tooltip content={inputPriceDesc}
                                                                relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                            </Tooltip>
                                                            <span style={{ marginRight: 8 }}></span>
                                                            {item.input_price}$ / 1M Token
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p>
                                                            <strong>{t("components.llmSelector.outputPrice")}</strong>
                                                            <Tooltip content={outputPriceDesc}
                                                                relationship="description" positioning="above"><InfoRegular></InfoRegular>
                                                            </Tooltip>
                                                            <span style={{ marginRight: 8 }}></span>
                                                            {item.output_price}$ / 1M Token
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={styles.price}
                                                        aria-label={`Price ${Number.isFinite(priceVal) ? `${priceVal}` : ""}`}
                                                    >
                                                        <strong style={{ marginRight: 8 }}>{t("components.llmSelector.price")}</strong>
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
                                <Button
                                    appearance="primary"
                                    size="medium"
                                    onClick={() => handleSelectModel(selectedModel)}
                                    className={styles.acceptButton}
                                >
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
            <Card
                selected={selected1}
                onSelectionChange={(_, { selected }) => setSelected1(selected)}
            />
        </div>
    );
};