import {
    DialogContent,
    Button,
    Divider,
    Field,
    Input,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    Text,
    mergeClasses
} from "@fluentui/react-components";
import {
    Add24Regular,
    ArrowBidirectionalUpDown24Regular,
    Delete24Regular,
    ReOrder24Regular,
    ArrowUp20Regular,
    ArrowDown20Regular,
    Edit24Regular,
    Checkmark24Regular,
    MoreHorizontal24Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useRef, useEffect, useId, useState } from "react";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

import styles from "./ConversationOptionsSection.module.css";
import { ExpandableTextarea } from "../ExpandableTextarea";
import { StarterPromptModel } from "../../../StarterPrompt";
import { FollowUpActionModel } from "../../../FollowUpAction";
import { generatePromptId } from "../promptIds";

interface ConversationOptionsSectionProps {
    followUpActions: FollowUpActionModel[];
    starterPrompts: StarterPromptModel[];
    isOwner: boolean;
    onFollowUpActionsChange: (followUpActions: FollowUpActionModel[]) => void;
    onStarterPromptsChange: (starterPrompts: StarterPromptModel[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

interface EditablePromptListConfig<T extends { id?: string }> {
    addLabel: string;
    description: string;
    displayLabel: string;
    editLabel: string;
    emptyDescription: string;
    emptyTitle: string;
    finishLabel: string;
    getPrompt: (item: T) => string;
    getTitle: (item: T) => string;
    itemType: string;
    newItem: () => T;
    promptLabel: string;
    promptPlaceholder: string;
    sectionTitle: string;
    titlePlaceholder: string;
    untitledLabel: string;
    updatePrompt: (item: T, value: string) => T;
    updateTitle: (item: T, value: string) => T;
    updateTitleOnBlur?: (item: T, value: string) => T;
}

interface EditablePromptItemProps<T extends { id?: string }> {
    config: EditablePromptListConfig<T>;
    index: number;
    isOwner: boolean;
    item: T;
    onChangePrompt: (index: number, value: string) => void;
    onChangeTitle: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlurTitle?: (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onMoveDown: (index: number) => void;
    onMoveUp: (index: number) => void;
    onRemove: (index: number) => void;
    totalCount: number;
}

const getPromptPreview = (prompt: string) => {
    const lines = prompt.trim().split(/\r?\n/);
    const previewLines = lines.slice(0, 2);
    const hasMoreLines = lines.length > previewLines.length;

    return `${previewLines.join("\n")}${hasMoreLines ? "\n..." : ""}`;
};

function EditablePromptItem<T extends { id?: string }>({
    config,
    index,
    isOwner,
    item,
    onChangePrompt,
    onChangeTitle,
    onBlurTitle,
    onMoveDown,
    onMoveUp,
    onRemove,
    totalCount
}: EditablePromptItemProps<T>) {
    const { t } = useTranslation();
    const itemRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLButtonElement>(null);
    const wasDraggingRef = useRef(false);
    const itemId = item.id;
    const titleInputId = useId();
    const promptTextareaId = useId();
    const titleLabelId = `${titleInputId}-label`;
    const promptLabelId = `${promptTextareaId}-label`;
    const [isDragging, setIsDragging] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
    const title = config.getTitle(item);
    const prompt = config.getPrompt(item);
    const [isEditing, setIsEditing] = useState(() => isOwner && (!title.trim() || !prompt.trim()));

    const isFirst = index === 0;
    const isLast = index === totalCount - 1;
    const displayText = title.trim() || config.untitledLabel;
    const promptPreview = getPromptPreview(prompt);
    const canFinishEditing = Boolean(title.trim() && prompt.trim());
    const editButtonLabel = isEditing ? config.finishLabel : config.editLabel;

    const handleEditToggle = useCallback(() => {
        if (isEditing && !canFinishEditing) return;
        setIsEditing(current => !current);
    }, [canFinishEditing, isEditing]);

    const handleItemClick = useCallback(() => {
        if (!isOwner || isEditing || wasDraggingRef.current) return;
        setIsEditing(true);
    }, [isEditing, isOwner]);

    const stopItemClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
    }, []);

    const moreOptionsMenu = (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<MoreHorizontal24Regular />}
                    aria-label={t("components.assistant_editor.more_options")}
                    title={t("components.assistant_editor.more_options")}
                    className={styles.moreOptionsButton}
                    onClick={stopItemClick}
                />
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    {isEditing ? (
                        <MenuItem icon={<Checkmark24Regular />} onClick={handleEditToggle} disabled={!canFinishEditing}>
                            {editButtonLabel}
                        </MenuItem>
                    ) : (
                        <MenuItem icon={<Edit24Regular />} onClick={handleEditToggle}>
                            {editButtonLabel}
                        </MenuItem>
                    )}
                    <MenuItem icon={<Delete24Regular />} onClick={() => onRemove(index)} className={styles.deleteMenuItem}>
                        {t("components.assistant_editor.remove")}
                    </MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    );

    useEffect(() => {
        if (!isEditing || !isOwner) return;

        const handleDocumentClick = (event: MouseEvent) => {
            const element = itemRef.current;
            if (!element || element.contains(event.target as Node)) return;
            if (!canFinishEditing) return;
            setIsEditing(false);
        };

        document.addEventListener("click", handleDocumentClick);
        return () => {
            document.removeEventListener("click", handleDocumentClick);
        };
    }, [canFinishEditing, isEditing, isOwner]);

    useEffect(() => {
        if (isOwner && (!title.trim() || !prompt.trim())) {
            setIsEditing(true);
        }
    }, [isOwner, prompt, title]);

    useEffect(() => {
        const element = itemRef.current;
        const handle = handleRef.current;
        if (!element || !handle || !isOwner) return;

        return combine(
            draggable({
                element,
                dragHandle: handle,
                getInitialData: () => ({ id: itemId, index, type: config.itemType }),
                onDragStart: () => {
                    wasDraggingRef.current = true;
                    setIsDragging(true);
                },
                onDrop: () => {
                    setIsDragging(false);
                    window.setTimeout(() => {
                        wasDraggingRef.current = false;
                    }, 0);
                }
            }),
            dropTargetForElements({
                element,
                getData: ({ input, element }) => attachClosestEdge({ id: itemId, index }, { input, element, allowedEdges: ["top", "bottom"] }),
                canDrop: ({ source }) => source.data.type === config.itemType && source.data.id !== itemId,
                onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
                onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null)
            })
        );
    }, [config.itemType, index, isOwner, itemId]);

    return (
        <div
            ref={itemRef}
            className={mergeClasses(
                styles.dynamicFieldItem,
                isEditing && styles.isEditing,
                isOwner && !isEditing && styles.canOpenEditor,
                isDragging && styles.isDragging
            )}
            onClick={handleItemClick}
        >
            {isOwner && (
                <div className={styles.dragHandleCell} onClick={stopItemClick}>
                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <Button
                                ref={handleRef}
                                appearance="transparent"
                                size="small"
                                className={styles.dragHandleButton}
                                title={t("components.assistant_editor.drag_to_reorder")}
                                aria-label={t("components.assistant_editor.dnd_aria_label", { position: index + 1, total: totalCount })}
                                onClick={stopItemClick}
                                icon={
                                    <span className={styles.dragIconSlot}>
                                        <span className={styles.dragIdleIcon}>
                                            <ArrowBidirectionalUpDown24Regular />
                                        </span>
                                        <span className={styles.dragHoverIcon}>
                                            <ReOrder24Regular />
                                        </span>
                                    </span>
                                }
                            ></Button>
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
                </div>
            )}
            <div className={styles.dynamicFieldInputs}>
                {isEditing ? (
                    <div className={styles.editFields}>
                        <Field
                            size="small"
                            required
                            className={styles.inputRow}
                            label={{ children: config.displayLabel, id: titleLabelId, htmlFor: titleInputId }}
                        >
                            <Input
                                id={titleInputId}
                                placeholder={config.titlePlaceholder}
                                value={title}
                                onChange={onChangeTitle(index)}
                                onBlur={onBlurTitle?.(index)}
                                disabled={!isOwner}
                                required
                                className={styles.dynamicFieldInput}
                            />
                        </Field>
                        <Field
                            size="small"
                            required
                            className={styles.inputRow}
                            label={{ children: config.promptLabel, id: promptLabelId, htmlFor: promptTextareaId }}
                        >
                            <ExpandableTextarea
                                id={promptTextareaId}
                                ariaLabelledBy={promptLabelId}
                                placeholder={config.promptPlaceholder}
                                value={prompt}
                                onChange={value => onChangePrompt(index, value)}
                                disabled={!isOwner}
                                rows={3}
                                dialogTitle={config.promptLabel}
                                className={styles.dynamicFieldInput}
                            />
                        </Field>
                    </div>
                ) : (
                    <div className={styles.summary}>
                        <Text weight="semibold" className={styles.displayText}>
                            {displayText}
                        </Text>
                        <Text size={200} className={styles.promptPreview}>
                            {promptPreview}
                        </Text>
                    </div>
                )}
            </div>
            {isOwner && (
                <div className={mergeClasses(styles.itemActions, isEditing && styles.editItemActions)} onClick={stopItemClick}>
                    {moreOptionsMenu}
                </div>
            )}
            {closestEdge && <div className={mergeClasses(styles.dropIndicator, styles[closestEdge])} />}
        </div>
    );
}

interface EditablePromptListProps<T extends { id?: string }> {
    config: EditablePromptListConfig<T>;
    isOwner: boolean;
    items: T[];
    onChange: (items: T[]) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

function EditablePromptList<T extends { id?: string }>({ config, isOwner, items, onChange, onHasChanged }: EditablePromptListProps<T>) {
    const listEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return monitorForElements({
            canMonitor: ({ source }) => source.data.type === config.itemType,
            onDrop: ({ source, location }) => {
                const target = location.current.dropTargets[0];
                if (!target) return;

                const sourceIndex = source.data.index as number;
                const targetIndex = target.data.index as number;
                const edge = extractClosestEdge(target.data);

                if (sourceIndex === targetIndex) return;

                onChange(
                    reorderWithEdge({
                        list: items,
                        startIndex: sourceIndex,
                        indexOfTarget: targetIndex,
                        closestEdgeOfTarget: edge,
                        axis: "vertical"
                    })
                );
                onHasChanged?.(true);
            }
        });
    }, [config.itemType, items, onChange, onHasChanged]);

    const handleMoveUp = useCallback(
        (index: number) => {
            if (index <= 0) return;
            const reordered = [...items];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index - 1, 0, moved);
            onChange(reordered);
            onHasChanged?.(true);
        },
        [items, onChange, onHasChanged]
    );

    const handleMoveDown = useCallback(
        (index: number) => {
            if (index >= items.length - 1) return;
            const reordered = [...items];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(index + 1, 0, moved);
            onChange(reordered);
            onHasChanged?.(true);
        },
        [items, onChange, onHasChanged]
    );

    const addItem = useCallback(() => {
        onChange([...items, config.newItem()]);
        onHasChanged?.(true);
        setTimeout(() => {
            listEndRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest"
            });
        }, 50);
    }, [config, items, onChange, onHasChanged]);

    const onChangeTitle = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const updated = [...items];
            updated[index] = config.updateTitle(updated[index], e.currentTarget.value);
            onChange(updated);
            onHasChanged?.(true);
        },
        [config, items, onChange, onHasChanged]
    );

    const onBlurTitle = useCallback(
        (index: number) => (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (!config.updateTitleOnBlur) return;
            const updated = [...items];
            updated[index] = config.updateTitleOnBlur(updated[index], e.currentTarget.value);
            onChange(updated);
        },
        [config, items, onChange]
    );

    const onChangePrompt = useCallback(
        (index: number, value: string) => {
            const updated = [...items];
            updated[index] = config.updatePrompt(updated[index], value);
            onChange(updated);
            onHasChanged?.(true);
        },
        [config, items, onChange, onHasChanged]
    );

    const removeItem = useCallback(
        (index: number) => {
            onChange(items.filter((_, i) => i !== index));
            onHasChanged?.(true);
        },
        [items, onChange, onHasChanged]
    );

    return (
        <section className={styles.promptLibrarySection} aria-labelledby={`${config.itemType}-heading`}>
            <div className={styles.subsectionHeader}>
                <div className={styles.subsectionHeaderText}>
                    <Text as="h3" id={`${config.itemType}-heading`} size={400} weight="semibold" className={styles.subsectionTitle}>
                        {config.sectionTitle}
                    </Text>
                    <Text as="p" size={200} className={styles.subsectionDescription}>
                        {config.description}
                    </Text>
                </div>
                {isOwner && (
                    <Button appearance="primary" size="small" icon={<Add24Regular />} onClick={addItem} className={styles.headerAddButton}>
                        {config.addLabel}
                    </Button>
                )}
            </div>
            <div className={styles.dndListContainer}>
                {items.length > 0 ? (
                    items.map((item, index) => (
                        <EditablePromptItem
                            key={item.id}
                            config={config}
                            item={item}
                            index={index}
                            totalCount={items.length}
                            isOwner={isOwner}
                            onChangeTitle={onChangeTitle}
                            onBlurTitle={config.updateTitleOnBlur ? onBlurTitle : undefined}
                            onChangePrompt={onChangePrompt}
                            onRemove={removeItem}
                            onMoveUp={handleMoveUp}
                            onMoveDown={handleMoveDown}
                        />
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <Text weight="semibold" className={styles.emptyStateTitle}>
                            {config.emptyTitle}
                        </Text>
                        <Text className={styles.emptyStateText}>{config.emptyDescription}</Text>
                    </div>
                )}
                <div ref={listEndRef} className={styles.listEndMarker} aria-hidden="true" />
            </div>
        </section>
    );
}

export const ConversationOptionsSection = ({
    followUpActions,
    starterPrompts,
    isOwner,
    onFollowUpActionsChange,
    onStarterPromptsChange,
    onHasChanged
}: ConversationOptionsSectionProps) => {
    const { t } = useTranslation();

    const followUpActionsConfig: EditablePromptListConfig<FollowUpActionModel> = {
        addLabel: t("components.assistant_editor.add_follow_up_action"),
        description: t("components.assistant_editor.follow_up_actions_description"),
        displayLabel: t("components.assistant_editor.follow_up_action_display_text"),
        editLabel: t("common.edit"),
        emptyDescription: t("components.assistant_editor.follow_up_actions_empty_description"),
        emptyTitle: t("components.assistant_editor.follow_up_actions_empty_title"),
        finishLabel: t("components.assistant_editor.finish_follow_up_action_edit"),
        getPrompt: item => item.prompt,
        getTitle: item => item.label,
        itemType: "quick-prompt",
        newItem: () => ({ id: generatePromptId(), label: "", prompt: "", tooltip: "" }),
        promptLabel: t("components.assistant_editor.follow_up_action_prompt"),
        promptPlaceholder: t("components.assistant_editor.follow_up_action_text_placeholder"),
        sectionTitle: t("components.assistant_editor.follow_up_actions"),
        titlePlaceholder: t("components.assistant_editor.follow_up_action_label_placeholder"),
        untitledLabel: t("components.assistant_editor.follow_up_action_untitled"),
        updatePrompt: (item, value) => ({ ...item, prompt: value }),
        updateTitle: (item, value) => ({ ...item, label: value }),
        updateTitleOnBlur: (item, value) => ({ ...item, tooltip: value })
    };

    const starterPromptsConfig: EditablePromptListConfig<StarterPromptModel> = {
        addLabel: t("components.assistant_editor.add_starter_prompt"),
        description: t("components.assistant_editor.starter_prompts_description"),
        displayLabel: t("components.assistant_editor.starter_prompt_display_text"),
        editLabel: t("common.edit"),
        emptyDescription: t("components.assistant_editor.starter_prompts_empty_description"),
        emptyTitle: t("components.assistant_editor.starter_prompts_empty_title"),
        finishLabel: t("components.assistant_editor.finish_starter_prompt_edit"),
        getPrompt: item => item.value,
        getTitle: item => item.text,
        itemType: "starter-prompt",
        newItem: () => ({ id: generatePromptId(), text: "", value: "" }),
        promptLabel: t("components.assistant_editor.starter_prompt_prompt"),
        promptPlaceholder: t("components.assistant_editor.starter_prompt_value_placeholder"),
        sectionTitle: t("components.assistant_editor.starter_prompts"),
        titlePlaceholder: t("components.assistant_editor.starter_prompt_text_placeholder"),
        untitledLabel: t("components.assistant_editor.starter_prompt_untitled"),
        updatePrompt: (item, value) => ({ ...item, value }),
        updateTitle: (item, value) => ({ ...item, text: value })
    };

    return (
        <DialogContent className={styles.promptLibraryContent}>
            <EditablePromptList
                config={starterPromptsConfig}
                items={starterPrompts}
                isOwner={isOwner}
                onChange={onStarterPromptsChange}
                onHasChanged={onHasChanged}
            />
            <Divider />
            <EditablePromptList
                config={followUpActionsConfig}
                items={followUpActions}
                isOwner={isOwner}
                onChange={onFollowUpActionsChange}
                onHasChanged={onHasChanged}
            />
        </DialogContent>
    );
};
