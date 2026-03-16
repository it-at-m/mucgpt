import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Spinner, Textarea, TextareaOnChangeData } from "@fluentui/react-components";
import { ArrowLeft24Regular, Edit24Regular, Wand24Regular } from "@fluentui/react-icons";

import styles from "./AssistantCreateFlow.module.css";

export type AssistantCreateFlowView = "mode_select" | "ai_input";

interface AssistantCreateFlowProps {
    view: AssistantCreateFlowView;
    input: string;
    loading: boolean;
    onSelectManual: () => void;
    onSelectGenerate: () => void;
    onInputChange: (value: string) => void;
    onGenerate: () => void;
    onBack: () => void;
    onExampleClick: (example: string) => void;
}

export function AssistantCreateFlow({
    view,
    input,
    loading,
    onSelectManual,
    onSelectGenerate,
    onInputChange,
    onGenerate,
    onBack,
    onExampleClick
}: AssistantCreateFlowProps) {
    const { t } = useTranslation();

    const examples = [
        { key: "example_one", textKey: "create_example_one" },
        { key: "example_two", textKey: "create_example_two" },
        { key: "example_three", textKey: "create_example_three" }
    ];

    if (view === "mode_select") {
        return (
            <div className={styles.modeSelectorContainer}>
                <p className={styles.modeSubtitle}>{t("components.assistant_editor.subtitle_mode_select")}</p>
                <div className={styles.modeCards}>
                    <button className={styles.modeCard} onClick={onSelectManual} type="button">
                        <div className={styles.modeCardIcon}>
                            <Edit24Regular />
                        </div>
                        <div className={styles.modeCardBody}>
                            <span className={styles.modeCardTitle}>{t("components.assistant_editor.create_manually")}</span>
                            <span className={styles.modeCardDescription}>{t("components.assistant_editor.create_manually_description")}</span>
                            <span className={styles.modeCardHint}>{t("components.assistant_editor.create_manually_hint")}</span>
                        </div>
                    </button>

                    <button className={styles.modeCard} onClick={onSelectGenerate} type="button">
                        <div className={styles.modeCardIcon}>
                            <Wand24Regular />
                        </div>
                        <div className={styles.modeCardBody}>
                            <span className={styles.modeCardTitle}>
                                {t("components.assistant_editor.generate_with_mucgpt")}
                                <span className={styles.recommendedBadge}>{t("components.assistant_editor.recommended")}</span>
                            </span>
                            <span className={styles.modeCardDescription}>{t("components.assistant_editor.generate_with_mucgpt_description")}</span>
                            <span className={styles.modeCardHint}>{t("components.assistant_editor.generate_with_mucgpt_hint")}</span>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.aiInputContainer}>
            <p className={styles.modeSubtitle}>{t("components.assistant_editor.subtitle_ai_input")}</p>

            <div className={styles.aiInputCard}>
                <span className={styles.aiInputTitle}>{t("components.assistant_editor.ai_input_label")}</span>

                <Textarea
                    placeholder={t("components.assistant_editor.ai_input_placeholder")}
                    value={input}
                    rows={6}
                    resize="vertical"
                    onChange={(_event: FormEvent<HTMLInputElement | HTMLTextAreaElement>, data?: TextareaOnChangeData) => onInputChange(data?.value || "")}
                    className={styles.aiTextarea}
                />


                <div className={styles.examplesSection}>
                    <span className={styles.examplesLabel}>{t("components.assistant_editor.try_example")}</span>
                    <div className={styles.exampleChips}>
                        {examples.map(example => {
                            const exampleText = t(`components.assistant_editor.${example.textKey}`);
                            const isSelected = input.trim() === exampleText.trim();

                            return (
                                <button
                                    key={example.key}
                                    className={`${styles.exampleChip} ${isSelected ? styles.exampleChipSelected : ""}`}
                                    onClick={() => onExampleClick(exampleText)}
                                    type="button"
                                    aria-pressed={isSelected}
                                >
                                    {t(`components.assistant_editor.${example.key}`)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.aiInputActions}>
                    <Button appearance="subtle" icon={<ArrowLeft24Regular />} onClick={onBack} disabled={loading}>
                        {t("common.back")}
                    </Button>
                    <Button
                        appearance="primary"
                        onClick={onGenerate}
                        disabled={loading || !input.trim()}
                        icon={loading ? <Spinner size="tiny" /> : <Wand24Regular />}
                    >
                        {loading ? t("components.assistant_editor.generating") : t("components.assistant_editor.generate_button")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
