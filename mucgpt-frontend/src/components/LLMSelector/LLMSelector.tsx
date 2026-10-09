import {
    Body1,
    Body1Strong,
    makeStyles,
    Menu,
    MenuList,
    MenuPopover,
    MenuTrigger,
    tokens,
    Tooltip,
    typographyStyles,
    type MenuProps
} from "@fluentui/react-components";
import { ChevronDown16Regular, Info16Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import styles from "./LLMSelector.module.css";
import { Model } from "../../api";
import { Button } from "../../ui/Button";
import { MenuItemRadio } from "../../ui/MenuItem";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

const MODEL_GROUP = "model";
const RATING_STEPS = 3;
const VIEWPORT_GUTTER = 16;

// Fluent caps the menu popover width; the two-column picker sizes itself to its content instead.
const useStyles = makeStyles({
    popover: {
        width: "max-content",
        maxWidth: `calc(100vw - ${2 * VIEWPORT_GUTTER}px)`,
        padding: 0,
        overflow: "hidden"
    },
    // Fluent's default menu subtext (10px) is smaller than any other text in the picker.
    subText: typographyStyles.caption1,
    // Quieter than the subtle button's default text so the model name doesn't compete with the input.
    trigger: {
        color: tokens.colorNeutralForeground3,
        fontWeight: tokens.fontWeightRegular,
        // The chevron already carries its own whitespace; full button padding leaves a wide gap to the next action.
        paddingRight: tokens.spacingHorizontalSNudge
    }
});

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const getAveragePrice = (model: Model): number | null => {
    const input = toNumber(model.input_cost_per_token);
    const output = toNumber(model.output_cost_per_token);
    if (input !== null && output !== null) return (input + output) / 2;
    return input ?? output;
};

// Rates a value from 1 to RATING_STEPS relative to the other offered models. Prices and context sizes differ
// by factors rather than fixed amounts, so the scale is logarithmic: an outlier must not squash the others.
const getRelativeRating = (value: number | null, values: number[]): number | null => {
    if (value === null || value <= 0) return null;
    const logValues = values.filter(candidate => candidate > 0).map(Math.log);
    const min = Math.min(...logValues);
    const max = Math.max(...logValues);
    if (max === min) return RATING_STEPS;
    return Math.round(((Math.log(value) - min) / (max - min)) * (RATING_STEPS - 1)) + 1;
};

const formatKnowledgeDate = (value: string | null | undefined, language: string): string | undefined => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
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

const getDisplayName = (llmName: string) => llmName.split("/").pop() || llmName;

const RatingMeter = ({ value, label }: { value: number; label: string }) => (
    <span className={styles.meter} role="img" aria-label={label}>
        {Array.from({ length: RATING_STEPS }, (_, index) => (
            <span key={index} className={styles.meterStep} data-active={index < value} />
        ))}
    </span>
);

const Fact = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
    <>
        <dt className={styles.factLabel}>{label}</dt>
        <dd className={styles.factValue}>{children}</dd>
    </>
);

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    const { t, i18n } = useTranslation();
    const classes = useStyles();
    const [open, setOpen] = useState(false);
    const [previewLLM, setPreviewLLM] = useState(defaultLLM);
    const itemRefs = useRef(new Map<string, HTMLDivElement>());

    const priceValues = useMemo(() => options.map(getAveragePrice).filter((value): value is number => value !== null), [options]);
    const contextValues = useMemo(() => options.map(model => toNumber(model.max_input_tokens)).filter((value): value is number => value !== null), [options]);

    // Fluent focuses the first item on open; start on the selected model so keyboard users and the details panel agree.
    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => itemRefs.current.get(defaultLLM)?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open, defaultLLM]);

    const handleOpenChange: MenuProps["onOpenChange"] = (_, data) => {
        setOpen(data.open);
        if (data.open) setPreviewLLM(defaultLLM);
    };

    const handleCheckedValueChange: MenuProps["onCheckedValueChange"] = (_, data) => {
        const nextLLM = data.checkedItems[0];
        if (nextLLM && nextLLM !== defaultLLM) onSelectionChange(nextLLM);
    };

    const previewModel = options.find(model => model.llm_name === previewLLM) ?? options.find(model => model.llm_name === defaultLLM);
    const title = t("components.llmSelector.title");

    const renderDetails = (model: Model, active: boolean) => {
        const description = model.description?.trim();
        const knowledge = formatKnowledgeDate(model.knowledge_cut_off, i18n.resolvedLanguage || i18n.language);
        const priceRating = getRelativeRating(getAveragePrice(model), priceValues);
        const contextRating = getRelativeRating(toNumber(model.max_input_tokens), contextValues);
        const ratingLabel = (label: string, value: number) => `${label}: ${t("components.llmSelector.rating", { value, max: RATING_STEPS })}`;

        return (
            <div key={model.llm_name} className={styles.details} data-active={active}>
                <Body1Strong>{getDisplayName(model.llm_name)}</Body1Strong>
                {(knowledge || priceRating !== null || contextRating !== null) && (
                    <dl className={styles.facts}>
                        {priceRating !== null && (
                            <Fact label={t("components.llmSelector.cost")}>
                                <RatingMeter value={priceRating} label={ratingLabel(t("components.llmSelector.cost"), priceRating)} />
                            </Fact>
                        )}
                        {contextRating !== null && (
                            <Fact
                                label={
                                    <Tooltip content={t("components.llmSelector.context_description")} relationship="description" positioning="above" withArrow>
                                        <span className={styles.factHint}>
                                            {t("components.llmSelector.context")}
                                            <Info16Regular className={styles.factHintIcon} />
                                        </span>
                                    </Tooltip>
                                }
                            >
                                <RatingMeter value={contextRating} label={ratingLabel(t("components.llmSelector.context"), contextRating)} />
                            </Fact>
                        )}
                        {knowledge && <Fact label={t("components.llmSelector.knowledge")}>{knowledge}</Fact>}
                    </dl>
                )}
                {description && <Body1 className={styles.description}>{description}</Body1>}
            </div>
        );
    };

    return (
        <Menu
            open={open}
            onOpenChange={handleOpenChange}
            checkedValues={{ [MODEL_GROUP]: [defaultLLM] }}
            onCheckedValueChange={handleCheckedValueChange}
            positioning={{ position: "above", align: "end", offset: 8, overflowBoundaryPadding: VIEWPORT_GUTTER }}
        >
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={title} relationship="description" positioning="below">
                    <Button appearance="subtle" className={classes.trigger} icon={<ChevronDown16Regular />} iconPosition="after">
                        {getDisplayName(defaultLLM)}
                    </Button>
                </Tooltip>
            </MenuTrigger>
            <MenuPopover className={classes.popover}>
                <div className={styles.layout}>
                    <MenuList className={styles.list} aria-label={title}>
                        {options.map(model => {
                            const shortDescription = model.short_description?.trim();
                            return (
                                <MenuItemRadio
                                    key={model.llm_name}
                                    ref={element => {
                                        if (element) itemRefs.current.set(model.llm_name, element);
                                        else itemRefs.current.delete(model.llm_name);
                                    }}
                                    name={MODEL_GROUP}
                                    value={model.llm_name}
                                    subText={shortDescription ? { children: shortDescription, className: classes.subText } : undefined}
                                    onFocus={() => setPreviewLLM(model.llm_name)}
                                >
                                    {getDisplayName(model.llm_name)}
                                </MenuItemRadio>
                            );
                        })}
                    </MenuList>
                    {/* All details share one grid cell so the popover keeps the height of the longest one while previewing. */}
                    <div className={styles.detailsStack}>{options.map(model => renderDetails(model, model.llm_name === previewModel?.llm_name))}</div>
                </div>
            </MenuPopover>
        </Menu>
    );
};
