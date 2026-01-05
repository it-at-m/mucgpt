import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef } from "react";

import sharedStyles from "../AssistantDialog.module.css";
import { ExampleModel } from "../../../Example";

interface ExamplesStepProps {
    examples: ExampleModel[];
    isOwner: boolean;
    onExamplesChange: (examples: ExampleModel[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const ExamplesStep = ({ examples, isOwner, onExamplesChange, onHasChanged }: ExamplesStepProps) => {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLDivElement>(null);

    const addExample = useCallback(() => {
        // Only add if there is no empty example
        const hasEmpty = examples.some(ex => !ex.text.trim() || !ex.value.trim());
        if (!hasEmpty) {
            onExamplesChange([...examples, { id: crypto.randomUUID(), text: "", value: "" }]);
            onHasChanged?.(true);
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
            onHasChanged?.(true);
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
            onHasChanged?.(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    const removeExample = useCallback(
        (index: number) => {
            onExamplesChange(examples.filter((_, i) => i !== index));
            onHasChanged?.(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={sharedStyles.formField}>
                <label className={sharedStyles.formLabel}>{t("components.edit_assistant_dialog.examples")}</label>
                <div className={sharedStyles.dynamicFieldContainer}>
                    <div className={sharedStyles.dynamicFieldList}>
                        {examples.length > 0 ? (
                            examples.map((ex, index) => (
                                <div key={ex.id || index} className={sharedStyles.dynamicFieldItem}>
                                    <div className={sharedStyles.dynamicFieldInputs}>
                                        <div className={sharedStyles.dynamicFieldInputRow}>
                                            <span className={sharedStyles.dynamicFieldInputLabel}>Text:</span>
                                            <Input
                                                placeholder={t("components.edit_assistant_dialog.example_text_placeholder")}
                                                value={ex.text}
                                                onChange={onChangeExampleText(index)}
                                                disabled={!isOwner}
                                                className={sharedStyles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={sharedStyles.dynamicFieldInputRow}>
                                            <span className={sharedStyles.dynamicFieldInputLabel}>Value:</span>
                                            <Textarea
                                                placeholder={t("components.edit_assistant_dialog.example_value_placeholder")}
                                                value={ex.value}
                                                onChange={onChangeExampleValue(index)}
                                                disabled={!isOwner}
                                                rows={2}
                                                className={sharedStyles.dynamicFieldInput}
                                            />
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <button
                                            className={sharedStyles.removeFieldButton}
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
                            <div className={sharedStyles.noToolsText}>{t("components.edit_assistant_dialog.no_examples_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <div ref={buttonRef}>
                            <Button appearance="subtle" onClick={addExample} disabled={!isOwner} className={sharedStyles.addFieldButton}>
                                <Add24Regular /> {t("components.edit_assistant_dialog.add_example")}
                            </Button>
                        </div>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
