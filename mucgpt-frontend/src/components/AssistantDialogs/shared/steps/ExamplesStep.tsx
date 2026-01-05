import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, Reorder20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

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

    const onDragEnd = useCallback(
        (result: DropResult) => {
            if (!result.destination) {
                return;
            }

            const items = Array.from(examples);
            const [reorderedItem] = items.splice(result.source.index, 1);
            items.splice(result.destination.index, 0, reorderedItem);

            onExamplesChange(items);
            onHasChanged?.(true);
        },
        [examples, onExamplesChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={sharedStyles.formField}>
                <label className={sharedStyles.formLabel}>{t("components.edit_assistant_dialog.examples")}</label>
                <div className={sharedStyles.dynamicFieldContainer}>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="examples">
                            {(provided) => (
                                <div className={sharedStyles.dynamicFieldList} {...provided.droppableProps} ref={provided.innerRef}>
                                    {examples.length > 0 ? (
                                        <>
                                            {examples.map((ex, index) => (
                                                <Draggable key={ex.id || index} draggableId={ex.id || `example-${index}`} index={index} isDragDisabled={!isOwner}>
                                                    {(provided, snapshot) => {
                                                        // Fix for positioning offset during drag
                                                        const draggableStyle = provided.draggableProps.style;
                                                        const style: React.CSSProperties = {
                                                            ...draggableStyle,
                                                            opacity: snapshot.isDragging ? 0.8 : 1,
                                                            left: draggableStyle?.left ?? 'auto',
                                                            top: draggableStyle?.top ?? 'auto'
                                                        };

                                                        return (
                                                            <div ref={provided.innerRef} {...provided.draggableProps} style={style} className={sharedStyles.dynamicFieldItem}>
                                                            {isOwner && (
                                                                <div {...provided.dragHandleProps} className={sharedStyles.dragHandle} title={t("components.edit_assistant_dialog.drag_to_reorder")}>
                                                                    <Reorder20Regular />
                                                                </div>
                                                            )}
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
                                                        );
                                                    }}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </>
                                    ) : (
                                        <div className={sharedStyles.noToolsText}>{t("components.edit_assistant_dialog.no_examples_selected")}</div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
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
