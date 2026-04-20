import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Popover,
    PopoverTrigger,
    PopoverSurface,
    Button,
    Tooltip,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogTrigger
} from "@fluentui/react-components";
import { Checkmark16Regular, QuestionCircle16Regular, Dismiss12Regular, Dismiss24Regular, LockClosed16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./ChatToolSelector.module.css";
import { ToolInfo, ToolListResponse } from "../../api/models";

const MAX_VISIBLE_BADGES = 2;

const TOOL_TUTORIAL_MAP: Record<string, string> = {
    Brainstorming: "/tutorials/brainstorm",
    Vereinfachen: "/tutorials/simplify"
};

interface ChatToolSelectorProps {
    tools: ToolListResponse;
    selectedTools: string[];
    setSelectedTools: React.Dispatch<React.SetStateAction<string[]>>;
    allowToolSelection?: boolean;
    lockedToolIds?: string[];
}

interface ToolGroup {
    name: string;
    tools: ToolInfo[];
}

interface GroupActiveBadge {
    type: "group";
    groupName: string;
    activeTools: ToolInfo[];
    allGroupTools: ToolInfo[];
}

interface IndividualActiveBadge {
    type: "individual";
    tool: ToolInfo;
}

interface LockedGroupBadge {
    type: "locked-group";
    groupName: string;
    tools: ToolInfo[];
}

interface LockedIndividualBadge {
    type: "locked-individual";
    tool: ToolInfo;
}

type ActiveBadge = GroupActiveBadge | IndividualActiveBadge | LockedGroupBadge | LockedIndividualBadge;

function buildGroups(allTools: ToolInfo[]): { groups: ToolGroup[]; ungrouped: ToolInfo[] } {
    const groupMap = new Map<string, ToolInfo[]>();
    const ungrouped: ToolInfo[] = [];

    for (const tool of allTools) {
        if (tool.mcp_group) {
            const existing = groupMap.get(tool.mcp_group);
            if (existing) {
                existing.push(tool);
            } else {
                groupMap.set(tool.mcp_group, [tool]);
            }
        } else {
            ungrouped.push(tool);
        }
    }

    return {
        groups: Array.from(groupMap.entries()).map(([name, tools]) => ({ name, tools })),
        ungrouped
    };
}

interface UseHoverPopoverOptions {
    isCompact: boolean;
    hoverEnabled?: boolean;
    forceClose?: boolean;
}

const useHoverPopover = ({ isCompact, hoverEnabled = true, forceClose = false }: UseHoverPopoverOptions) => {
    const [open, setOpen] = useState(false);
    const badgeRef = useRef<HTMLDivElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
            }
        },
        []
    );

    const clearCloseTimeout = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const isMovingWithinOverlay = useCallback((nextTarget: EventTarget | null) => {
        if (!(nextTarget instanceof Node)) {
            return false;
        }

        return !!(badgeRef.current?.contains(nextTarget) || surfaceRef.current?.contains(nextTarget));
    }, []);

    const openPopover = useCallback(() => {
        if (isCompact || !hoverEnabled) return;
        clearCloseTimeout();
        setOpen(true);
    }, [clearCloseTimeout, hoverEnabled, isCompact]);

    const scheduleClosePopover = useCallback(() => {
        if (isCompact) return;
        clearCloseTimeout();
        closeTimeoutRef.current = setTimeout(() => setOpen(false), 180);
    }, [clearCloseTimeout, isCompact]);

    const handleMouseLeave = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            if (isCompact || isMovingWithinOverlay(event.relatedTarget)) {
                return;
            }

            scheduleClosePopover();
        },
        [isCompact, isMovingWithinOverlay, scheduleClosePopover]
    );

    const handleCompactOpenChange = useCallback(
        (_: unknown, data: { open: boolean }) => {
            if (isCompact) {
                setOpen(data.open);
            }
        },
        [isCompact]
    );

    useEffect(() => {
        if (forceClose) {
            clearCloseTimeout();
            setOpen(false);
        }
    }, [clearCloseTimeout, forceClose]);

    useEffect(() => {
        if (isCompact || open) {
            clearCloseTimeout();
        }
    }, [clearCloseTimeout, isCompact, open]);

    return {
        open,
        badgeRef,
        surfaceRef,
        clearCloseTimeout,
        openPopover,
        handleMouseLeave,
        handleCompactOpenChange
    };
};

type GroupBadgePopoverItemProps =
    | {
          kind: "active";
          badge: GroupActiveBadge;
          onDismissGroup: (groupName: string) => void;
          onToggleGroup: (groupTools: ToolInfo[]) => void;
          allowToolSelection: boolean;
          isCompact: boolean;
          renderToolItem: (tool: ToolInfo) => React.ReactNode;
          removeAriaLabel: string;
      }
    | {
          kind: "locked";
          badge: LockedGroupBadge;
          isCompact: boolean;
          renderToolItem: (tool: ToolInfo) => React.ReactNode;
          lockedBadgeLabel: string;
      };

const GroupBadgePopoverItem = (props: GroupBadgePopoverItemProps) => {
    const { t } = useTranslation();
    const isLocked = props.kind === "locked";
    const badge = props.badge;
    const activeProps = props.kind === "active" ? props : null;
    const activeBadge = props.kind === "active" ? props.badge : null;
    const lockedBadge = props.kind === "locked" ? props.badge : null;
    const allowSelection = activeProps?.allowToolSelection ?? true;
    const groupTools = lockedBadge?.tools ?? activeBadge?.allGroupTools ?? [];
    const selectedCount = lockedBadge?.tools.length ?? activeBadge?.activeTools.length ?? 0;
    const triggerDisabled = !allowSelection;
    const allSelected = !!activeBadge && activeBadge.activeTools.length === activeBadge.allGroupTools.length;
    const { open, badgeRef, surfaceRef, clearCloseTimeout, openPopover, handleMouseLeave, handleCompactOpenChange } = useHoverPopover({
        isCompact: props.isCompact,
        hoverEnabled: isLocked || allowSelection,
        forceClose: !isLocked && !allowSelection
    });

    const handleDismissGroup = useCallback(() => {
        if (!activeProps || !activeBadge) return;
        clearCloseTimeout();
        activeProps.onDismissGroup(badge.groupName);
    }, [activeBadge, activeProps, badge.groupName, clearCloseTimeout]);

    const handleToggleGroup = useCallback(() => {
        if (!activeProps || !activeBadge) return;
        clearCloseTimeout();
        activeProps.onToggleGroup(activeBadge.allGroupTools);
    }, [activeBadge, activeProps, clearCloseTimeout]);

    const triggerContent = (
        <Button appearance="transparent" className={styles.groupBadgeLabel} disabled={triggerDisabled}>
            {isLocked && <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />}
            <span>{badge.groupName}</span>
            <span className={styles.groupBadgeCount}>{selectedCount}</span>
        </Button>
    );

    const toolList = <div className={styles.groupHoverToolList}>{groupTools.map(props.renderToolItem)}</div>;
    const groupActionLabel = allSelected ? t("components.questioninput.disable_all") : t("components.questioninput.enable_all");
    const headerAction = isLocked ? (
        <span>
            <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />
            {props.lockedBadgeLabel}
        </span>
    ) : (
        <Button
            size="small"
            appearance="subtle"
            shape="circular"
            className={styles.groupHeaderActionButton}
            onClick={handleToggleGroup}
            disabled={!allowSelection}
        >
            {groupActionLabel}
        </Button>
    );

    return (
        <div
            ref={badgeRef}
            className={isLocked ? styles.lockedBadge : `${styles.activeBadge} ${!allowSelection ? styles.activeBadgeDisabled : ""}`}
            onMouseEnter={openPopover}
            onMouseLeave={handleMouseLeave}
        >
            {props.isCompact ? (
                <Dialog open={open} onOpenChange={handleCompactOpenChange}>
                    <DialogTrigger disableButtonEnhancement>{triggerContent}</DialogTrigger>
                    <DialogSurface className={styles.groupDetailDialog}>
                        <DialogBody className={styles.groupDetailDialogBody}>
                            {isLocked ? (
                                <DialogTitle>{badge.groupName}</DialogTitle>
                            ) : (
                                <DialogTitle
                                    action={
                                        <div className={styles.groupDialogTitleActions}>
                                            {headerAction}
                                            <DialogTrigger action="close">
                                                <Button appearance="subtle" aria-label={t("close")} icon={<Dismiss24Regular />} />
                                            </DialogTrigger>
                                        </div>
                                    }
                                >
                                    {badge.groupName}
                                </DialogTitle>
                            )}
                            <DialogContent className={styles.groupDetailDialogContent}>
                                {isLocked && (
                                    <div className={styles.groupHoverHeaderRow}>
                                        <div className={`${styles.popoverEyebrow} ${styles.groupHoverPopoverHeader}`}>{badge.groupName}</div>
                                        {headerAction}
                                    </div>
                                )}
                                {toolList}
                            </DialogContent>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            ) : (
                <Popover open={open} positioning={{ position: "above", align: "start", offset: { mainAxis: 6 } }}>
                    <PopoverTrigger disableButtonEnhancement>{triggerContent}</PopoverTrigger>
                    <PopoverSurface ref={surfaceRef} className={styles.groupHoverSurface} onMouseEnter={openPopover} onMouseLeave={handleMouseLeave}>
                        <div className={styles.groupHoverHeaderRow}>
                            <div className={`${styles.popoverEyebrow} ${styles.groupHoverPopoverHeader}`}>{badge.groupName}</div>
                            {headerAction}
                        </div>
                        {toolList}
                    </PopoverSurface>
                </Popover>
            )}
            {!isLocked && (
                <Button
                    size="small"
                    appearance="transparent"
                    shape="circular"
                    icon={<Dismiss12Regular />}
                    className={styles.dismissTrigger}
                    onClick={handleDismissGroup}
                    disabled={!allowSelection}
                    aria-label={props.removeAriaLabel}
                />
            )}
        </div>
    );
};

interface ToolRowProps {
    tool: ToolInfo;
    isLocked?: boolean;
    isSelected?: boolean;
    allowToolSelection: boolean;
    onToggle?: (toolId: string) => void;
    onOpenTutorial: (toolId: string, event: React.MouseEvent) => void;
}

const ToolRow = ({ tool, isLocked = false, isSelected = false, allowToolSelection, onToggle, onOpenTutorial }: ToolRowProps) => {
    const { t } = useTranslation();
    const hasTutorial = !!TOOL_TUTORIAL_MAP[tool.id];
    const showActiveState = isLocked || isSelected;
    const titleContent = (
        <span className={styles.toolItemContent}>
            <span className={`${styles.statusDot} ${showActiveState ? styles.statusDotActive : ""}`} aria-hidden="true" />
            <span className={styles.toolItemTitleRow}>
                <span className={styles.toolItemName}>{tool.name}</span>
            </span>
        </span>
    );

    return (
        <div key={tool.id} className={`${styles.toolItem} ${isLocked ? styles.lockedToolItem : ""} ${isSelected ? styles.toolItemSelected : ""}`}>
            <div className={styles.toolItemMain}>
                <div className={styles.toolItemInfoGroup}>
                    {isLocked ? (
                        <div className={styles.toolItemStatic}>{titleContent}</div>
                    ) : (
                        <Button
                            appearance="transparent"
                            className={styles.toolItemToggle}
                            aria-pressed={isSelected}
                            onClick={() => onToggle?.(tool.id)}
                            disabled={!allowToolSelection}
                        >
                            {titleContent}
                        </Button>
                    )}
                    {hasTutorial && (
                        <Tooltip content={t("components.questioninput.tutorial_help")} relationship="label">
                            <Button
                                size="small"
                                icon={<QuestionCircle16Regular />}
                                appearance="transparent"
                                className={`${styles.tutorialButton} ${styles.toolItemTutorialButton}`}
                                onClick={event => onOpenTutorial(tool.id, event)}
                                aria-label={t("components.questioninput.tutorial_help_aria", { tool: tool.id })}
                            />
                        </Tooltip>
                    )}
                </div>
                <span className={styles.toolItemActions}>
                    {isLocked ? (
                        <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />
                    ) : (
                        <span className={`${styles.checkCircle} ${!isSelected ? styles.checkCircleHidden : ""}`} aria-hidden="true">
                            <Checkmark16Regular className={styles.checkIcon} />
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
};

export const ChatToolSelector = ({ tools, selectedTools, setSelectedTools, allowToolSelection = true, lockedToolIds = [] }: ChatToolSelectorProps) => {
    const { t } = useTranslation();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<string[]>([]);
    const [isCompact, setIsCompact] = useState(() =>
        typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)").matches : false
    );
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [frozenTarget, setFrozenTarget] = useState<{ getBoundingClientRect: () => DOMRect } | null>(null);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(max-width: 640px)");
        const handler = (event: MediaQueryListEvent) => setIsCompact(event.matches);
        setIsCompact(mq.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        if (!allowToolSelection) {
            setPopoverOpen(false);
            setOpenGroups([]);
        }
    }, [allowToolSelection]);

    const handlePopoverOpenChange = useCallback((_: unknown, data: { open: boolean }) => {
        if (data.open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const frozenRect = new DOMRect(rect.left, rect.top, rect.width, rect.height);
            setFrozenTarget({ getBoundingClientRect: () => frozenRect });
        }

        if (!data.open) {
            setFrozenTarget(null);
        }

        setPopoverOpen(data.open);
    }, []);

    const lockedToolIdSet = useMemo(() => new Set(lockedToolIds), [lockedToolIds]);
    const selectedOptionalTools = useMemo(() => selectedTools.filter(toolId => !lockedToolIdSet.has(toolId)), [lockedToolIdSet, selectedTools]);
    const { lockedGroups, lockedUngrouped, selectableGroups, selectableUngrouped } = useMemo(() => {
        const lockedTools = tools.tools.filter(tool => lockedToolIdSet.has(tool.id));
        const selectableTools = tools.tools.filter(tool => !lockedToolIdSet.has(tool.id));
        const lockedGrouped = buildGroups(lockedTools);
        const selectableGrouped = buildGroups(selectableTools);

        return {
            lockedGroups: lockedGrouped.groups,
            lockedUngrouped: lockedGrouped.ungrouped,
            selectableGroups: selectableGrouped.groups,
            selectableUngrouped: selectableGrouped.ungrouped
        };
    }, [lockedToolIdSet, tools.tools]);
    const hasLockedTools = lockedGroups.length > 0 || lockedUngrouped.length > 0;
    const hasSelectableTools = selectableGroups.length > 0 || selectableUngrouped.length > 0;

    const activeBadges = useMemo((): ActiveBadge[] => {
        const badges: ActiveBadge[] = [];

        for (const group of lockedGroups) {
            if (group.tools.length > 0) {
                badges.push({
                    type: "locked-group",
                    groupName: group.name,
                    tools: group.tools
                });
            }
        }

        for (const tool of lockedUngrouped) {
            badges.push({ type: "locked-individual", tool });
        }

        for (const group of selectableGroups) {
            const activeGroupTools = group.tools.filter(tool => selectedOptionalTools.includes(tool.id));
            if (activeGroupTools.length > 0) {
                badges.push({
                    type: "group",
                    groupName: group.name,
                    activeTools: activeGroupTools,
                    allGroupTools: group.tools
                });
            }
        }

        for (const tool of selectableUngrouped) {
            if (selectedOptionalTools.includes(tool.id)) {
                badges.push({ type: "individual", tool });
            }
        }

        return badges;
    }, [lockedGroups, lockedUngrouped, selectableGroups, selectableUngrouped, selectedOptionalTools]);

    const visibleBadges = activeBadges.slice(0, MAX_VISIBLE_BADGES);
    const overflowCount = Math.max(0, activeBadges.length - MAX_VISIBLE_BADGES);

    const toggleTool = useCallback(
        (toolId: string) => {
            if (!allowToolSelection) return;
            setSelectedTools(prev => (prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]));
        },
        [setSelectedTools, allowToolSelection]
    );

    const dismissIndividualTool = useCallback(
        (toolId: string) => {
            if (!allowToolSelection) return;
            setSelectedTools(prev => prev.filter(id => id !== toolId));
        },
        [setSelectedTools, allowToolSelection]
    );

    const dismissGroup = useCallback(
        (groupName: string) => {
            if (!allowToolSelection) return;
            const group = selectableGroups.find(item => item.name === groupName);
            if (!group) return;
            const groupIds = new Set(group.tools.map(tool => tool.id));
            setSelectedTools(prev => prev.filter(id => !groupIds.has(id)));
        },
        [selectableGroups, setSelectedTools, allowToolSelection]
    );

    const toggleGroup = useCallback(
        (groupTools: ToolInfo[]) => {
            if (!allowToolSelection) return;
            const groupIds = groupTools.map(tool => tool.id);
            setSelectedTools(prev => {
                const allSelected = groupIds.every(id => prev.includes(id));
                if (allSelected) return prev.filter(id => !groupIds.includes(id));
                const next = [...prev];
                for (const id of groupIds) {
                    if (!next.includes(id)) next.push(id);
                }
                return next;
            });
        },
        [setSelectedTools, allowToolSelection]
    );

    const handleAccordionToggle = useCallback((_: unknown, data: { openItems: unknown | unknown[] }) => {
        const nextOpenGroups = Array.isArray(data.openItems) ? data.openItems.filter((value): value is string => typeof value === "string") : [];
        setOpenGroups(nextOpenGroups);
    }, []);

    const handleAccordionHeaderClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest(".fui-AccordionHeader__button") || target.closest(`.${styles.groupHeaderActionButton}`)) {
            return;
        }

        const headerButton = event.currentTarget.querySelector<HTMLButtonElement>(".fui-AccordionHeader__button");
        headerButton?.click();
    }, []);

    const openTutorial = useCallback((toolId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const route = TOOL_TUTORIAL_MAP[toolId];
        if (route) {
            window.open(`#${route}`, "_blank", "noopener,noreferrer");
        }
    }, []);
    const lockedBadgeLabel = t("components.questioninput.assistant_tool_locked");

    const renderToolItem = useCallback(
        (tool: ToolInfo) => (
            <ToolRow
                key={tool.id}
                tool={tool}
                isSelected={selectedTools.includes(tool.id)}
                allowToolSelection={allowToolSelection}
                onToggle={toggleTool}
                onOpenTutorial={openTutorial}
            />
        ),
        [selectedTools, allowToolSelection, toggleTool, openTutorial]
    );

    const renderLockedToolItem = useCallback(
        (tool: ToolInfo) => <ToolRow key={tool.id} tool={tool} isLocked allowToolSelection={allowToolSelection} onOpenTutorial={openTutorial} />,
        [allowToolSelection, openTutorial]
    );

    return (
        <div className={styles.toolSelectorRow}>
            {activeBadges.length === 0 && <span className={styles.emptyStateBadge}>{t("components.questioninput.no_tools_active")}</span>}

            {visibleBadges.map(badge => {
                if (badge.type === "group") {
                    return (
                        <GroupBadgePopoverItem
                            key={`group-${badge.groupName}`}
                            kind="active"
                            badge={badge}
                            onDismissGroup={dismissGroup}
                            onToggleGroup={toggleGroup}
                            allowToolSelection={allowToolSelection}
                            isCompact={isCompact}
                            renderToolItem={renderToolItem}
                            removeAriaLabel={t("components.questioninput.remove_tool_aria", { tool: badge.groupName })}
                        />
                    );
                }

                if (badge.type === "locked-group") {
                    return (
                        <GroupBadgePopoverItem
                            key={`locked-group-${badge.groupName}`}
                            kind="locked"
                            badge={badge}
                            isCompact={isCompact}
                            renderToolItem={renderLockedToolItem}
                            lockedBadgeLabel={lockedBadgeLabel}
                        />
                    );
                }

                if (badge.type === "locked-individual") {
                    return (
                        <Tooltip key={`locked-tool-${badge.tool.id}`} content={lockedBadgeLabel} relationship="label">
                            <span className={styles.lockedBadge}>
                                <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />
                                <span className={styles.badgeLabel}>{badge.tool.name}</span>
                            </span>
                        </Tooltip>
                    );
                }

                return (
                    <Button
                        key={`tool-${badge.tool.id}`}
                        appearance="secondary"
                        className={styles.activeBadge}
                        onClick={() => dismissIndividualTool(badge.tool.id)}
                        disabled={!allowToolSelection}
                        aria-label={t("components.questioninput.remove_tool_aria", { tool: badge.tool.name })}
                    >
                        <span className={styles.badgeLabel}>{badge.tool.name}</span>
                    </Button>
                );
            })}

            {overflowCount > 0 && <span className={styles.overflowBadge}>{t("components.questioninput.more_tools", { count: overflowCount })}</span>}

            {hasSelectableTools && (
                <Popover
                    open={popoverOpen}
                    onOpenChange={handlePopoverOpenChange}
                    positioning={{
                        position: "above",
                        align: "start",
                        offset: { mainAxis: 10 },
                        strategy: "fixed",
                        ...(frozenTarget && { target: frozenTarget })
                    }}
                >
                    <PopoverTrigger disableButtonEnhancement>
                        <Button ref={triggerRef} shape="circular" appearance="primary" className={styles.addToolBadge} disabled={!allowToolSelection}>
                            {t("components.questioninput.add_tool")}
                        </Button>
                    </PopoverTrigger>
                    <PopoverSurface className={styles.popoverSurface}>
                        <div className={`${styles.popoverEyebrow} ${styles.popoverHeader}`}>{t("components.questioninput.available_tools")}</div>

                        {hasLockedTools && (
                            <>
                                <div className={`${styles.popoverEyebrow} ${styles.popoverSectionHeader}`}>
                                    {t("components.questioninput.assistant_tools_section")}
                                </div>
                                {lockedGroups.map(group => (
                                    <div key={`locked-section-${group.name}`} className={styles.lockedToolSection}>
                                        <div className={styles.lockedToolSectionHeader}>
                                            <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />
                                            <span className={`${styles.popoverEyebrow} ${styles.lockedToolSectionTitle}`}>{group.name}</span>
                                        </div>
                                        <div className={styles.groupToolsList}>{group.tools.map(renderLockedToolItem)}</div>
                                    </div>
                                ))}
                                {lockedUngrouped.length > 0 && <div className={styles.ungroupedList}>{lockedUngrouped.map(renderLockedToolItem)}</div>}
                                <div className={`${styles.popoverEyebrow} ${styles.popoverSectionHeader}`}>
                                    {t("components.questioninput.optional_tools_section")}
                                </div>
                            </>
                        )}

                        {selectableGroups.length > 0 && (
                            <Accordion className={styles.groupAccordion} collapsible multiple openItems={openGroups} onToggle={handleAccordionToggle}>
                                {selectableGroups.map(group => {
                                    const groupIds = group.tools.map(tool => tool.id);
                                    const selectedCount = groupIds.filter(id => selectedTools.includes(id)).length;
                                    const allSelected = group.tools.length > 0 && selectedCount === group.tools.length;
                                    const groupActionLabel = allSelected ? t("components.questioninput.disable_all") : t("components.questioninput.enable_all");

                                    return (
                                        <AccordionItem key={group.name} value={group.name} className={styles.accordionGroup}>
                                            <div className={styles.accordionGroupHeader} onClick={handleAccordionHeaderClick}>
                                                <AccordionHeader className={styles.accordionHeader} expandIconPosition="end">
                                                    <span className={styles.groupAccordionHeaderContent}>
                                                        <span
                                                            className={`${styles.statusDot} ${selectedCount > 0 ? styles.statusDotActive : ""}`}
                                                            aria-hidden="true"
                                                        />
                                                        <span className={styles.groupTitleBlock}>
                                                            <span className={styles.groupName}>{group.name}</span>
                                                            <span className={styles.groupCount}>
                                                                {selectedCount}/{group.tools.length}
                                                            </span>
                                                        </span>
                                                    </span>
                                                </AccordionHeader>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    shape="circular"
                                                    className={styles.groupHeaderActionButton}
                                                    onClick={event => {
                                                        event.stopPropagation();
                                                        toggleGroup(group.tools);
                                                    }}
                                                    disabled={!allowToolSelection}
                                                >
                                                    {groupActionLabel}
                                                </Button>
                                            </div>
                                            <AccordionPanel className={styles.accordionPanel}>
                                                <div className={styles.groupToolsList}>{group.tools.map(renderToolItem)}</div>
                                            </AccordionPanel>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        )}

                        {selectableUngrouped.length > 0 && <div className={styles.ungroupedList}>{selectableUngrouped.map(renderToolItem)}</div>}
                    </PopoverSurface>
                </Popover>
            )}
        </div>
    );
};
