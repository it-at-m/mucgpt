import { DialogContent, Field, Button, Input, Textarea, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem } from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, ReOrderDotsVertical24Regular, ArrowUp20Regular, ArrowDown20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef, useEffect, useState, memo } from "react";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

import sharedStyles from "../AssistantDialog.module.css";
import { QuickPrompt } from "../../../QuickPrompt/QuickPrompt";

interface QuickPromptsStepProps {
    quickPrompts: QuickPrompt[];
    isOwner: boolean;
    onQuickPromptsChange: (quickPrompts: QuickPrompt[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

interface DraggableQuickPromptItemProps {
    qp: QuickPrompt;
    index: number;
    totalCount: number;
    isOwner: boolean;
    onChangeLabel: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlurLabel: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onChangePrompt: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onRemove: (index: number) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
}

const DraggableQuickPromptItem = memo(
    ({ qp, index, totalCount, isOwner, onChangeLabel, onBlurLabel, onChangePrompt, onRemove, onMoveUp, onMoveDown }: DraggableQuickPromptItemProps) => {
        const { t } = useTranslation();
        const itemRef = useRef<HTMLDivElement>(null);
        const handleRef = useRef<HTMLButtonElement>(null);
        const [isDragging, setIsDragging] = useState(false);
        const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

        const isFirst = index === 0;
        const isLast = index === totalCount - 1;

        // Mouse drag-and-drop
        useEffect(() => {
            const element = itemRef.current;
            const handle = handleRef.current;
            if (!element || !handle || !isOwner) return;

            return combine(
                draggable({
                    element,
                    dragHandle: handle,
                    getInitialData: () => ({ id: qp.id, index, type: "quick-prompt" }),
                    onDragStart: () => setIsDragging(true),
                    onDrop: () => setIsDragging(false)
                }),
                dropTargetForElements({
                    element,
                    getData: ({ input, element }) => {
                        return attachClosestEdge({ id: qp.id, index }, { input, element, allowedEdges: ["top", "bottom"] });
                    },
                    canDrop: ({ source }) => source.data.type === "quick-prompt" && source.data.id !== qp.id,
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
        }, [qp.id, index, isOwner]);

        return (
            <div ref={itemRef} className={`${sharedStyles.dynamicFieldItem} ${sharedStyles.draggableItem} ${isDragging ? sharedStyles.isDragging : ""}`}>
                {isOwner && (
                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <button
                                ref={handleRef}
                                type="button"
                                className={sharedStyles.dragHandleButton}
                                title={t("components.edit_assistant_dialog.drag_to_reorder")}
                                aria-label={t("components.edit_assistant_dialog.dnd_aria_label", { position: index + 1, total: totalCount })}
                            >
                                <ReOrderDotsVertical24Regular />
                            </button>
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem icon={<ArrowUp20Regular />} onClick={() => onMoveUp(index)} disabled={isFirst}>
                                    {t("components.edit_assistant_dialog.move_up")}
                                </MenuItem>
                                <MenuItem icon={<ArrowDown20Regular />} onClick={() => onMoveDown(index)} disabled={isLast}>
                                    {t("components.edit_assistant_dialog.move_down")}
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                )}
                <div className={sharedStyles.dynamicFieldInputs}>
                    <div className={sharedStyles.dynamicFieldInputRow}>
                        <span className={sharedStyles.dynamicFieldInputLabel}>Label:</span>
                        <Input
                            placeholder={t("components.edit_assistant_dialog.quick_prompt_label_placeholder")}
                            value={qp.label}
                            onChange={onChangeLabel(index)}
                            onBlur={onBlurLabel(index)}
                            disabled={!isOwner}
                            className={sharedStyles.dynamicFieldInput}
                        />
                    </div>
                    <div className={sharedStyles.dynamicFieldInputRow}>
                        <span className={sharedStyles.dynamicFieldInputLabel}>Prompt:</span>
                        <Textarea
                            placeholder={t("components.edit_assistant_dialog.quick_prompt_text_placeholder")}
                            value={qp.prompt}
                            onChange={onChangePrompt(index)}
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
    }
);

DraggableQuickPromptItem.displayName = "DraggableQuickPromptItem";

export const QuickPromptsStep = ({ quickPrompts, isOwner, onQuickPromptsChange, onHasChanged }: QuickPromptsStepProps) => {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLDivElement>(null);

    // Monitor for drag-and-drop reordering
    useEffect(() => {
        return monitorForElements({
            canMonitor: ({ source }) => source.data.type === "quick-prompt",
            onDrop: ({ source, location }) => {
                const target = location.current.dropTargets[0];
                if (!target) return;

                const sourceIndex = source.data.index as number;
                const targetIndex = target.data.index as number;
                const edge = extractClosestEdge(target.data);

                if (sourceIndex === targetIndex) return;

                const reordered = reorderWithEdge({
                    list: quickPrompts,
                    startIndex: sourceIndex,
                    indexOfTarget: targetIndex,
                    closestEdgeOfTarget: edge,
                    axis: "vertical"
                });

                onQuickPromptsChange(reordered);
                onHasChanged?.(true);
            }
        });
    }, [quickPrompts, onQuickPromptsChange, onHasChanged]);

    // Menu reorder handlers
    const handleMoveUp = useCallback(
        (index: number) => {
            if (index <= 0) return;
            const reordered = [...quickPrompts];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index - 1, 0, moved);
            onQuickPromptsChange(reordered);
            onHasChanged?.(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    const handleMoveDown = useCallback(
        (index: number) => {
            if (index >= quickPrompts.length - 1) return;
            const reordered = [...quickPrompts];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index + 1, 0, moved);
            onQuickPromptsChange(reordered);
            onHasChanged?.(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    const addQuickPrompt = useCallback(() => {
        // Only add if there is no empty quick prompt
        const hasEmpty = quickPrompts.some(ex => !ex.label.trim() || !ex.prompt.trim());
        if (!hasEmpty) {
            onQuickPromptsChange([...quickPrompts, { id: crypto.randomUUID(), label: "", prompt: "", tooltip: "" }]);
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
            onHasChanged?.(true);
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
            onHasChanged?.(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    const removeQuickPrompt = useCallback(
        (index: number) => {
            onQuickPromptsChange(quickPrompts.filter((_, i) => i !== index));
            onHasChanged?.(true);
        },
        [quickPrompts, onQuickPromptsChange, onHasChanged]
    );

    return (
        <DialogContent>
            {isOwner && (
                <p className={sharedStyles.hintText}>
                    <strong>{t("common.hint")}</strong> {t("components.edit_assistant_dialog.dnd_reorder_hint")}
                </p>
            )}
            <Field size="large" className={sharedStyles.formField}>
                <label className={sharedStyles.formLabel}>{t("components.edit_assistant_dialog.quick_prompts")}</label>
                <div className={sharedStyles.dndFieldContainer}>
                    <div className={sharedStyles.dndListContainer}>
                        {quickPrompts.length > 0 ? (
                            quickPrompts.map((qp, index) => (
                                <DraggableQuickPromptItem
                                    key={qp.id || index}
                                    qp={qp}
                                    index={index}
                                    totalCount={quickPrompts.length}
                                    isOwner={isOwner}
                                    onChangeLabel={onChangeQuickPromptLabel}
                                    onBlurLabel={onBlurQuickPromptLabel}
                                    onChangePrompt={onChangeQuickPromptPrompt}
                                    onRemove={removeQuickPrompt}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                />
                            ))
                        ) : (
                            <div className={sharedStyles.noToolsText}>{t("components.edit_assistant_dialog.no_quick_prompts_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <div ref={buttonRef}>
                            <Button appearance="subtle" onClick={addQuickPrompt} className={sharedStyles.addFieldButton}>
                                <Add24Regular /> {t("components.edit_assistant_dialog.add_quick_prompt")}
                            </Button>
                        </div>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
