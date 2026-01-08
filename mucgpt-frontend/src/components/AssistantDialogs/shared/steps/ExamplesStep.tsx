import { DialogContent, Field, Button, Input, Textarea } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, ReOrderDotsVertical24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef, useEffect, useState, memo } from "react";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

import sharedStyles from "../AssistantDialog.module.css";
import { ExampleModel } from "../../../Example";

interface ExamplesStepProps {
    examples: ExampleModel[];
    isOwner: boolean;
    onExamplesChange: (examples: ExampleModel[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

interface DraggableExampleItemProps {
    example: ExampleModel;
    index: number;
    isOwner: boolean;
    onChangeText: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onChangeValue: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onRemove: (index: number) => void;
}

const DraggableExampleItem = memo(({ example, index, isOwner, onChangeText, onChangeValue, onRemove }: DraggableExampleItemProps) => {
    const { t } = useTranslation();
    const itemRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLButtonElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        const element = itemRef.current;
        const handle = handleRef.current;
        if (!element || !handle || !isOwner) return;

        return combine(
            draggable({
                element,
                dragHandle: handle,
                getInitialData: () => ({ id: example.id, index, type: "example" }),
                onDragStart: () => setIsDragging(true),
                onDrop: () => setIsDragging(false)
            }),
            dropTargetForElements({
                element,
                getData: ({ input, element }) => {
                    return attachClosestEdge({ id: example.id, index }, { input, element, allowedEdges: ["top", "bottom"] });
                },
                canDrop: ({ source }) => source.data.type === "example" && source.data.id !== example.id,
                onDragEnter: ({ self }) => {
                    const edge = extractClosestEdge(self.data);
                    setClosestEdge(edge);
                },
                onDrag: ({ self }) => {
                    const edge = extractClosestEdge(self.data);
                    setClosestEdge(edge);
                },
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null)
            })
        );
    }, [example.id, index, isOwner]);

    return (
        <div ref={itemRef} className={`${sharedStyles.dynamicFieldItem} ${sharedStyles.draggableItem} ${isDragging ? sharedStyles.isDragging : ""}`}>
            {isOwner && (
                <button ref={handleRef} type="button" className={sharedStyles.dragHandleButton} title={t("components.edit_assistant_dialog.drag_to_reorder")}>
                    <ReOrderDotsVertical24Regular />
                </button>
            )}
            <div className={sharedStyles.dynamicFieldInputs}>
                <div className={sharedStyles.dynamicFieldInputRow}>
                    <span className={sharedStyles.dynamicFieldInputLabel}>Text:</span>
                    <Input
                        placeholder={t("components.edit_assistant_dialog.example_text_placeholder")}
                        value={example.text}
                        onChange={onChangeText(index)}
                        disabled={!isOwner}
                        className={sharedStyles.dynamicFieldInput}
                    />
                </div>
                <div className={sharedStyles.dynamicFieldInputRow}>
                    <span className={sharedStyles.dynamicFieldInputLabel}>Value:</span>
                    <Textarea
                        placeholder={t("components.edit_assistant_dialog.example_value_placeholder")}
                        value={example.value}
                        onChange={onChangeValue(index)}
                        disabled={!isOwner}
                        rows={2}
                        className={sharedStyles.dynamicFieldInput}
                    />
                </div>
            </div>
            {isOwner && (
                <button
                    type="button"
                    className={sharedStyles.removeFieldButton}
                    onClick={() => onRemove(index)}
                    title={t("components.edit_assistant_dialog.remove")}
                >
                    <Delete24Regular />
                </button>
            )}
            {closestEdge && <div className={`${sharedStyles.dropIndicator} ${sharedStyles[closestEdge]}`} />}
        </div>
    );
});

DraggableExampleItem.displayName = "DraggableExampleItem";

export const ExamplesStep = ({ examples, isOwner, onExamplesChange, onHasChanged }: ExamplesStepProps) => {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLDivElement>(null);

    // Monitor for drag-and-drop reordering
    useEffect(() => {
        return monitorForElements({
            canMonitor: ({ source }) => source.data.type === "example",
            onDrop: ({ source, location }) => {
                const target = location.current.dropTargets[0];
                if (!target) return;

                const sourceIndex = source.data.index as number;
                const targetIndex = target.data.index as number;
                const edge = extractClosestEdge(target.data);

                if (sourceIndex === targetIndex) return;

                const reordered = reorderWithEdge({
                    list: examples,
                    startIndex: sourceIndex,
                    indexOfTarget: targetIndex,
                    closestEdgeOfTarget: edge,
                    axis: "vertical"
                });

                onExamplesChange(reordered);
                onHasChanged?.(true);
            }
        });
    }, [examples, onExamplesChange, onHasChanged]);

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
            {isOwner && (
                <p className={sharedStyles.hintText}>
                    <strong>{t("common.hint")}</strong> {t("components.edit_assistant_dialog.dnd_reorder_hint")}
                </p>
            )}
            <Field size="large" className={sharedStyles.formField}>
                <label className={sharedStyles.formLabel}>{t("components.edit_assistant_dialog.examples")}</label>
                <div className={sharedStyles.dndFieldContainer}>
                    <div className={sharedStyles.dndListContainer}>
                        {examples.length > 0 ? (
                            examples.map((ex, index) => (
                                <DraggableExampleItem
                                    key={ex.id || index}
                                    example={ex}
                                    index={index}
                                    isOwner={isOwner}
                                    onChangeText={onChangeExampleText}
                                    onChangeValue={onChangeExampleValue}
                                    onRemove={removeExample}
                                />
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
