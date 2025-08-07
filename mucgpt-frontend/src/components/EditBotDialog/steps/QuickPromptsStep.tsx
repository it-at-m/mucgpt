import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditBotDialog.module.css";

interface QuickPrompt {
    label: string;
    prompt: string;
    tooltip: string;
}

interface QuickPromptsStepProps {
    quickPrompts: QuickPrompt[];
    isOwner: boolean;
    onQuickPromptsChange: (quickPrompts: QuickPrompt[]) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const QuickPromptsStep = ({ quickPrompts, isOwner, onQuickPromptsChange, onHasChanged }: QuickPromptsStepProps) => {
    const { t } = useTranslation();

    const addQuickPrompt = useCallback(() => {
        // Only add if there is no empty quick prompt
        const hasEmpty = quickPrompts.some(ex => !ex.label.trim() || !ex.prompt.trim());
        if (!hasEmpty) {
            onQuickPromptsChange([...quickPrompts, { label: "", prompt: "", tooltip: "" }]);
            onHasChanged(true);
        }
    }, [quickPrompts, onQuickPromptsChange, onHasChanged]);

    const onChangeQuickPromptLabel = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...quickPrompts];
            updated[index] = {
                ...updated[index],
                label: newValue
            };
            onQuickPromptsChange(updated);
            onHasChanged(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    const onBlurQuickPromptLabel = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...quickPrompts];
            updated[index] = {
                ...updated[index],
                tooltip: newValue
            };
            onQuickPromptsChange(updated);
        },
        [quickPrompts, onQuickPromptsChange]
    );

    const onChangeQuickPromptPrompt = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...quickPrompts];
            updated[index] = {
                ...updated[index],
                prompt: newValue
            };
            onQuickPromptsChange(updated);
            onHasChanged(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    const removeQuickPrompt = useCallback(
        (index: number) => {
            onQuickPromptsChange(quickPrompts.filter((_, i) => i !== index));
            onHasChanged(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.quick_prompts")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {quickPrompts.length > 0 ? (
                            quickPrompts.map((qp, index) => (
                                <div key={index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Label:</span>
                                            <Input
                                                placeholder={t("components.edit_bot_dialog.quick_prompt_label_placeholder")}
                                                value={qp.label}
                                                onChange={onChangeQuickPromptLabel(index)}
                                                onBlur={onBlurQuickPromptLabel(index)}
                                                disabled={!isOwner}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Prompt:</span>
                                            <Textarea
                                                placeholder={t("components.edit_bot_dialog.quick_prompt_text_placeholder")}
                                                value={qp.prompt}
                                                onChange={onChangeQuickPromptPrompt(index)}
                                                disabled={!isOwner}
                                                rows={2}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <button
                                            className={styles.removeFieldButton}
                                            onClick={() => removeQuickPrompt(index)}
                                            disabled={!isOwner}
                                            title={t("components.edit_bot_dialog.remove")}
                                        >
                                            <Delete24Regular />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_quick_prompts_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <Button appearance="subtle" onClick={addQuickPrompt} disabled={!isOwner} className={styles.addFieldButton}>
                            <Add24Regular /> {t("components.edit_bot_dialog.add_quick_prompt")}
                        </Button>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
