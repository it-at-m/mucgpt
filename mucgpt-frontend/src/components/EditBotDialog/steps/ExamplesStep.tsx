import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditBotDialog.module.css";

interface Example {
    text: string;
    value: string;
}

interface ExamplesStepProps {
    examples: Example[];
    isOwner: boolean;
    onExamplesChange: (examples: Example[]) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const ExamplesStep = ({ examples, isOwner, onExamplesChange, onHasChanged }: ExamplesStepProps) => {
    const { t } = useTranslation();

    const addExample = () => {
        // Only add if there is no empty example
        const hasEmpty = examples.some(ex => !ex.text.trim() || !ex.value.trim());
        if (!hasEmpty) {
            onExamplesChange([...examples, { text: "", value: "" }]);
            onHasChanged(true);
        }
    };

    const onChangeExampleText = useCallback(
        (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
            const updated = [...examples];
            updated[index].text = e.currentTarget.value;
            onExamplesChange(updated);
            onHasChanged(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    const onChangeExampleValue = useCallback(
        (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
            const updated = [...examples];
            updated[index].value = e.currentTarget.value;
            onExamplesChange(updated);
            onHasChanged(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    const removeExample = (index: number) => {
        onExamplesChange(examples.filter((_, i) => i !== index));
        onHasChanged(true);
    };

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.examples")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {examples.length > 0 ? (
                            examples.map((ex, index) => (
                                <div key={index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Text:</span>
                                            <Input
                                                placeholder={t("components.edit_bot_dialog.example_text_placeholder")}
                                                value={ex.text}
                                                onChange={e => onChangeExampleText(e, index)}
                                                disabled={!isOwner}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Value:</span>
                                            <Textarea
                                                placeholder={t("components.edit_bot_dialog.example_value_placeholder")}
                                                value={ex.value}
                                                onChange={e => onChangeExampleValue(e, index)}
                                                disabled={!isOwner}
                                                rows={2}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <button
                                            className={styles.removeFieldButton}
                                            onClick={() => removeExample(index)}
                                            disabled={!isOwner}
                                            title={t("components.edit_bot_dialog.remove")}
                                        >
                                            <Delete24Regular />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_examples_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <Button appearance="subtle" onClick={addExample} disabled={!isOwner} className={styles.addFieldButton}>
                            <Add24Regular /> {t("components.edit_bot_dialog.add_example")}
                        </Button>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
