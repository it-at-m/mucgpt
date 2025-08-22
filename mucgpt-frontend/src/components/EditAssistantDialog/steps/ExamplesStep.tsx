import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef } from "react";
import styles from "../EditAssistantDialog.module.css";

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
    const buttonRef = useRef<HTMLDivElement>(null);

    const addExample = useCallback(() => {
        // Only add if there is no empty example
        const hasEmpty = examples.some(ex => !ex.text.trim() || !ex.value.trim());
        if (!hasEmpty) {
            onExamplesChange([...examples, { text: "", value: "" }]);
            onHasChanged(true);
            // Scroll to bottom after adding
            setTimeout(() => {
                buttonRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest"
                });
            }, 50);
        }
    }, [examples, onExamplesChange, onHasChanged]);

    const onChangeExampleText = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...examples];
            updated[index] = {
                ...updated[index],
                text: newValue
            };
            onExamplesChange(updated);
            onHasChanged(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    const onChangeExampleValue = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...examples];
            updated[index] = {
                ...updated[index],
                value: newValue
            };
            onExamplesChange(updated);
            onHasChanged(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    const removeExample = useCallback(
        (index: number) => {
            onExamplesChange(examples.filter((_, i) => i !== index));
            onHasChanged(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_assistant_dialog.examples")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {examples.length > 0 ? (
                            examples.map((ex, index) => (
                                <div key={index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Text:</span>
                                            <Input
                                                placeholder={t("components.edit_assistant_dialog.example_text_placeholder")}
                                                value={ex.text}
                                                onChange={onChangeExampleText(index)}
                                                disabled={!isOwner}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Value:</span>
                                            <Textarea
                                                placeholder={t("components.edit_assistant_dialog.example_value_placeholder")}
                                                value={ex.value}
                                                onChange={onChangeExampleValue(index)}
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
                                            title={t("components.edit_assistant_dialog.remove")}
                                        >
                                            <Delete24Regular />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_assistant_dialog.no_examples_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <div ref={buttonRef}>
                            <Button appearance="subtle" onClick={addExample} disabled={!isOwner} className={styles.addFieldButton}>
                                <Add24Regular /> {t("components.edit_assistant_dialog.add_example")}
                            </Button>
                        </div>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
