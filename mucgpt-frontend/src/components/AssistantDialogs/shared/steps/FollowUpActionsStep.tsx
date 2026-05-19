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

interface FollowUpActionsStepProps {
    followUpActions: QuickPrompt[];
    isOwner: boolean;
    onFollowUpActionsChange: (followUpActions: QuickPrompt[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

interface DraggableFollowUpActionItemProps {
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

const DraggableFollowUpActionItem = memo(
    ({ qp, index, totalCount, isOwner, onChangeLabel, onBlurLabel, onChangePrompt, onRemove, onMoveUp, onMoveDown }: DraggableFollowUpActionItemProps) => {
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
                                title={t("components.assistant_editor.drag_to_reorder")}
                                aria-label={t("components.assistant_editor.dnd_aria_label", { position: index + 1, total: totalCount })}
                            >
                                <ReOrderDotsVertical24Regular />
                            </button>
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem icon={<ArrowUp20Regular />} onClick={() => onMoveUp(index)} disabled={isFirst}>
                                    {t("components.assistant_editor.move_up")}
                                </MenuItem>
                                <MenuItem icon={<ArrowDown20Regular />} onClick={() => onMoveDown(index)} disabled={isLast}>
                                    {t("components.assistant_editor.move_down")}
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                )}
                <div className={sharedStyles.dynamicFieldInputs}>
                    <div className={sharedStyles.dynamicFieldInputRow}>
                        <span className={sharedStyles.dynamicFieldInputLabel}>Label:</span>
                        <Input
                            placeholder={t("components.assistant_editor.follow_up_action_label_placeholder")}
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
                            placeholder={t("components.assistant_editor.follow_up_action_text_placeholder")}
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
                        title={t("components.assistant_editor.remove")}
                    >
                        <Delete24Regular />
                    </button>
                )}
                {closestEdge && <div className={`${sharedStyles.dropIndicator} ${sharedStyles[closestEdge]}`} />}
            </div>
        );
    }
);

DraggableFollowUpActionItem.displayName = "DraggableFollowUpActionItem";

export const FollowUpActionsStep = ({ followUpActions, isOwner, onFollowUpActionsChange, onHasChanged }: FollowUpActionsStepProps) => {
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
                    list: followUpActions,
                    startIndex: sourceIndex,
                    indexOfTarget: targetIndex,
                    closestEdgeOfTarget: edge,
                    axis: "vertical"
                });

                onFollowUpActionsChange(reordered);
                onHasChanged?.(true);
            }
        });
    }, [followUpActions, onFollowUpActionsChange, onHasChanged]);

    // Menu reorder handlers
    const handleMoveUp = useCallback(
        (index: number) => {
            if (index <= 0) return;
            const reordered = [...followUpActions];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index - 1, 0, moved);
            onFollowUpActionsChange(reordered);
            onHasChanged?.(true);
        },
        [followUpActions, onFollowUpActionsChange, onHasChanged]
    );

    const handleMoveDown = useCallback(
        (index: number) => {
            if (index >= followUpActions.length - 1) return;
            const reordered = [...followUpActions];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index + 1, 0, moved);
            onFollowUpActionsChange(reordered);
            onHasChanged?.(true);
        },
        [followUpActions, onFollowUpActionsChange, onHasChanged]
    );

    const addFollowUpAction = useCallback(() => {
        // Only add if there is no empty quick prompt
        const hasEmpty = followUpActions.some(ex => !ex.label.trim() || !ex.prompt.trim());
        if (!hasEmpty) {
            onFollowUpActionsChange([...followUpActions, { id: crypto.randomUUID(), label: "", prompt: "", tooltip: "" }]);
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
    }, [followUpActions, onFollowUpActionsChange, onHasChanged]);

    const onChangeFollowUpActionLabel = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...followUpActions];
            updated[index] = {
                ...updated[index],
                label: newValue
            };
            onFollowUpActionsChange(updated);
            onHasChanged?.(true);
        },
        [followUpActions, onFollowUpActionsChange, onHasChanged]
    );

    const onBlurFollowUpActionLabel = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...followUpActions];
            updated[index] = {
                ...updated[index],
                tooltip: newValue
            };
            onFollowUpActionsChange(updated);
        },
        [followUpActions, onFollowUpActionsChange]
    );

    const onChangeFollowUpActionPrompt = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.currentTarget.value;
            const updated = [...followUpActions];
            updated[index] = {
                ...updated[index],
                prompt: newValue
            };
            onFollowUpActionsChange(updated);
            onHasChanged?.(true);
        },
        [followUpActions, onFollowUpActionsChange, onHasChanged]
    );

    const removeFollowUpAction = useCallback(
        (index: number) => {
            onFollowUpActionsChange(followUpActions.filter((_, i) => i !== index));
            onHasChanged?.(true);
        },
        [followUpActions, onFollowUpActionsChange, onHasChanged]
    );

    return (
        <DialogContent>
            {isOwner && (
                <p className={sharedStyles.hintText}>
                    <strong>{t("common.hint")}</strong> {t("components.assistant_editor.dnd_reorder_hint")}
                </p>
            )}
            <Field size="large" className={sharedStyles.formField}>
                <label className={sharedStyles.formLabel}>{t("components.assistant_editor.follow_up_actions")}</label>
                <div className={sharedStyles.dndFieldContainer}>
                    <div className={sharedStyles.dndListContainer}>
                        {followUpActions.length > 0 ? (
                            followUpActions.map((qp, index) => (
                                <DraggableFollowUpActionItem
                                    key={qp.id}
                                    qp={qp}
                                    index={index}
                                    totalCount={followUpActions.length}
                                    isOwner={isOwner}
                                    onChangeLabel={onChangeFollowUpActionLabel}
                                    onBlurLabel={onBlurFollowUpActionLabel}
                                    onChangePrompt={onChangeFollowUpActionPrompt}
                                    onRemove={removeFollowUpAction}
                                    onMoveUp={handleMoveUp}
                                    onMoveDown={handleMoveDown}
                                />
                            ))
                        ) : (
                            <div className={sharedStyles.noToolsText}>{t("components.assistant_editor.no_follow_up_actions_selected")}</div>
                        )}
                    </div>
                    {isOwner && (
                        <div ref={buttonRef}>
                            <Button appearance="subtle" onClick={addFollowUpAction} className={sharedStyles.addFieldButton}>
                                <Add24Regular /> {t("components.assistant_editor.add_follow_up_action")}
                            </Button>
                        </div>
                    )}
                </div>
            </Field>
        </DialogContent>
    );
};
