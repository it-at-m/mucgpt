import {
    Body1,
    Body1Strong,
    makeStyles,
    Menu,
    MenuGroup,
    MenuGroupHeader,
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
import { getModelDisplayName } from "../../utils/modelDisplayName";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    /** Undefined while the `noneOption` is chosen. */
    selectedLLM?: string;
    options: Model[];
    /** Only the selected model is offered; all options remain the basis for the cost and context ratings. */
    lockedByAssistant?: boolean;
    /** Offers a first entry that selects no model. */
    noneOption?: { label: string; description?: string; onSelect: () => void };
    /** "subtle" sits quietly inside the chat input; "outline" reads as a form control. */
    appearance?: "subtle" | "outline";
    disabled?: boolean;
}

const MODEL_GROUP = "model";
// Model ids are never empty, so the empty string can't collide with a model.
const NONE_VALUE = "";
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
    },
    // A selection, not an action: the outline trigger keeps regular weight like other form values.
    fieldTrigger: {
        fontWeight: tokens.fontWeightRegular
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
    if (max === min) return null;
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

export const LLMSelector = ({
    onSelectionChange,
    selectedLLM,
    options,
    lockedByAssistant = false,
    noneOption,
    appearance = "subtle",
    disabled = false
}: Props) => {
    const { t, i18n } = useTranslation();
    const classes = useStyles();
    const [open, setOpen] = useState(false);
    const selectedValue = selectedLLM ?? NONE_VALUE;
    const [previewLLM, setPreviewLLM] = useState(selectedValue);
    const itemRefs = useRef(new Map<string, HTMLDivElement>());

    const priceValues = useMemo(() => options.map(getAveragePrice).filter((value): value is number => value !== null), [options]);
    const contextValues = useMemo(() => options.map(model => toNumber(model.max_input_tokens)).filter((value): value is number => value !== null), [options]);

    // Fluent focuses the first item on open; start on the selected model so keyboard users and the details panel agree.
    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => itemRefs.current.get(selectedValue)?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open, selectedValue]);

    const handleOpenChange: MenuProps["onOpenChange"] = (_, data) => {
        setOpen(data.open);
        if (data.open) setPreviewLLM(selectedValue);
    };

    const handleCheckedValueChange: MenuProps["onCheckedValueChange"] = (_, data) => {
        const nextValue = data.checkedItems[0];
        if (nextValue === undefined || nextValue === selectedValue) return;
        if (nextValue === NONE_VALUE) noneOption?.onSelect();
        else onSelectionChange(nextValue);
    };

    const registerItem = (value: string) => (element: HTMLDivElement | null) => {
        if (element) itemRefs.current.set(value, element);
        else itemRefs.current.delete(value);
    };

    const visibleModels = lockedByAssistant ? options.filter(model => model.llm_name === selectedLLM) : options;
    const previewModel =
        previewLLM === NONE_VALUE
            ? undefined
            : (visibleModels.find(model => model.llm_name === previewLLM) ?? visibleModels.find(model => model.llm_name === selectedLLM));
    const title = t("components.llmSelector.title");

    const renderDetails = (model: Model, active: boolean) => {
        const description = model.description?.trim();
        const knowledge = formatKnowledgeDate(model.knowledge_cut_off, i18n.resolvedLanguage || i18n.language);
        const priceRating = getRelativeRating(getAveragePrice(model), priceValues);
        const contextRating = getRelativeRating(toNumber(model.max_input_tokens), contextValues);
        const ratingLabel = (label: string, value: number) => `${label}: ${t("components.llmSelector.rating", { value, max: RATING_STEPS })}`;

        return (
            <div key={model.llm_name} className={styles.details} data-active={active}>
                <Body1Strong>{getModelDisplayName(model.llm_name, options)}</Body1Strong>
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

    const modelItems = visibleModels.map(model => {
        const shortDescription = model.short_description?.trim();
        return (
            <MenuItemRadio
                key={model.llm_name}
                ref={registerItem(model.llm_name)}
                name={MODEL_GROUP}
                value={model.llm_name}
                subText={shortDescription ? { children: shortDescription, className: classes.subText } : undefined}
                onFocus={() => setPreviewLLM(model.llm_name)}
            >
                {getModelDisplayName(model.llm_name, options)}
            </MenuItemRadio>
        );
    });

    const noneItem = noneOption && (
        <MenuItemRadio ref={registerItem(NONE_VALUE)} name={MODEL_GROUP} value={NONE_VALUE} onFocus={() => setPreviewLLM(NONE_VALUE)}>
            {noneOption.label}
        </MenuItemRadio>
    );
    const isSubtle = appearance === "subtle";

    return (
        <Menu
            open={open}
            onOpenChange={handleOpenChange}
            checkedValues={{ [MODEL_GROUP]: [selectedValue] }}
            onCheckedValueChange={handleCheckedValueChange}
            positioning={{
                position: isSubtle ? "above" : "below",
                align: "end",
                offset: 8,
                overflowBoundaryPadding: VIEWPORT_GUTTER
            }}
        >
            <MenuTrigger disableButtonEnhancement>
                <Tooltip content={title} relationship="description" positioning="below">
                    <Button
                        appearance={appearance}
                        className={isSubtle ? classes.trigger : classes.fieldTrigger}
                        icon={<ChevronDown16Regular />}
                        iconPosition="after"
                        disabled={disabled}
                    >
                        {selectedLLM ? getModelDisplayName(selectedLLM, options) : noneOption?.label}
                    </Button>
                </Tooltip>
            </MenuTrigger>
            <MenuPopover className={classes.popover}>
                <div className={styles.layout}>
                    <MenuList className={styles.list} aria-label={title}>
                        {lockedByAssistant ? (
                            <MenuGroup>
                                <MenuGroupHeader>{t("components.llmSelector.locked_by_assistant")}</MenuGroupHeader>
                                {modelItems}
                            </MenuGroup>
                        ) : (
                            <>
                                {noneItem}
                                {modelItems}
                            </>
                        )}
                    </MenuList>
                    {/* All details share one grid cell so the popover keeps the height of the longest one while previewing. */}
                    <div className={styles.detailsStack}>
                        {noneOption && (
                            <div className={styles.details} data-active={!previewModel}>
                                <Body1Strong>{noneOption.label}</Body1Strong>
                                {noneOption.description && <Body1 className={styles.description}>{noneOption.description}</Body1>}
                            </div>
                        )}
                        {visibleModels.map(model => renderDetails(model, model.llm_name === previewModel?.llm_name))}
                    </div>
                </div>
            </MenuPopover>
        </Menu>
    );
};
