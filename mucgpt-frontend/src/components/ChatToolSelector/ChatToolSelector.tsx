import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
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
import { Checkmark16Regular, QuestionCircle16Regular, ChevronDown16Regular, Dismiss12Regular, Dismiss16Regular, Dismiss24Regular } from "@fluentui/react-icons";
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

type ActiveBadge = GroupActiveBadge | IndividualActiveBadge;

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

interface GroupBadgeItemProps {
    badge: GroupActiveBadge;
    onDismissGroup: (groupName: string) => void;
    onToggleGroup: (groupTools: ToolInfo[]) => void;
    allowToolSelection: boolean;
    isCompact: boolean;
    renderToolItem: (tool: ToolInfo) => React.ReactNode;
    removeAriaLabel: string;
}

const GroupBadgeItem = ({ badge, onDismissGroup, onToggleGroup, allowToolSelection, isCompact, renderToolItem, removeAriaLabel }: GroupBadgeItemProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const badgeRef = useRef<HTMLDivElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const allSelected = badge.activeTools.length === badge.allGroupTools.length;

    useEffect(() => {
        if (!allowToolSelection) {
            setOpen(false);
        }
    }, [allowToolSelection]);

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

    const isMovingWithinGroupBadge = useCallback((nextTarget: EventTarget | null) => {
        if (!(nextTarget instanceof Node)) {
            return false;
        }

        return !!(badgeRef.current?.contains(nextTarget) || surfaceRef.current?.contains(nextTarget));
    }, []);

    const openPopover = useCallback(() => {
        if (isCompact || !allowToolSelection) return;
        clearCloseTimeout();
        setOpen(true);
    }, [allowToolSelection, clearCloseTimeout, isCompact]);

    const scheduleClosePopover = useCallback(() => {
        if (isCompact) return;
        clearCloseTimeout();
        closeTimeoutRef.current = setTimeout(() => setOpen(false), 180);
    }, [clearCloseTimeout, isCompact]);

    const handleMouseLeave = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            if (isCompact || isMovingWithinGroupBadge(event.relatedTarget)) {
                return;
            }

            scheduleClosePopover();
        },
        [isCompact, isMovingWithinGroupBadge, scheduleClosePopover]
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
        if (isCompact) {
            clearCloseTimeout();
        }
    }, [clearCloseTimeout, isCompact]);

    useEffect(() => {
        if (open) {
            clearCloseTimeout();
        }
    }, [clearCloseTimeout, open]);

    const handleDismissGroup = useCallback(() => {
        clearCloseTimeout();
        onDismissGroup(badge.groupName);
    }, [badge.groupName, clearCloseTimeout, onDismissGroup]);

    const handleToggleGroup = useCallback(() => {
        clearCloseTimeout();
        onToggleGroup(badge.allGroupTools);
    }, [badge.allGroupTools, clearCloseTimeout, onToggleGroup]);

    const groupToolList = <div className={styles.groupHoverToolList}>{badge.allGroupTools.map(renderToolItem)}</div>;
    const groupActionLabel = allSelected ? t("components.questioninput.disable_all") : t("components.questioninput.enable_all");
    const groupActionIcon = allSelected ? <Dismiss16Regular /> : <Checkmark16Regular />;

    return (
        <div
            ref={badgeRef}
            className={`${styles.activeBadge} ${!allowToolSelection ? styles.activeBadgeDisabled : ""}`}
            onMouseEnter={openPopover}
            onMouseLeave={handleMouseLeave}
        >
            {isCompact ? (
                <Dialog open={open} onOpenChange={handleCompactOpenChange}>
                    <DialogTrigger disableButtonEnhancement>
                        <button type="button" className={styles.groupBadgeLabel} disabled={!allowToolSelection}>
                            <span>{badge.groupName}</span>&nbsp;
                            <span className={styles.groupBadgeCount}>{badge.activeTools.length}</span>
                        </button>
                    </DialogTrigger>
                    <DialogSurface className={styles.groupDetailDialog}>
                        <DialogBody className={styles.groupDetailDialogBody}>
                            <DialogTitle
                                action={
                                    <div className={styles.groupDialogTitleActions}>
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={groupActionIcon}
                                            className={styles.groupHeaderActionButton}
                                            onClick={handleToggleGroup}
                                            disabled={!allowToolSelection}
                                        >
                                            {groupActionLabel}
                                        </Button>
                                        <DialogTrigger action="close">
                                            <Button appearance="subtle" aria-label={t("close")} icon={<Dismiss24Regular />} />
                                        </DialogTrigger>
                                    </div>
                                }
                            >
                                {badge.groupName}
                            </DialogTitle>
                            <DialogContent className={styles.groupDetailDialogContent}>{groupToolList}</DialogContent>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            ) : (
                <Popover open={open} positioning={{ position: "above", align: "start", offset: { mainAxis: 6 } }}>
                    <PopoverTrigger disableButtonEnhancement>
                        <button type="button" className={styles.groupBadgeLabel} disabled={!allowToolSelection}>
                            <span>{badge.groupName}</span>&nbsp;
                            <span className={styles.groupBadgeCount}>{badge.activeTools.length}</span>
                        </button>
                    </PopoverTrigger>
                    <PopoverSurface ref={surfaceRef} className={styles.groupHoverSurface} onMouseEnter={openPopover} onMouseLeave={handleMouseLeave}>
                        <div className={styles.groupHoverHeaderRow}>
                            <div className={styles.groupHoverPopoverHeader}>{badge.groupName}</div>
                            <Button
                                size="small"
                                appearance="subtle"
                                icon={groupActionIcon}
                                className={styles.groupHeaderActionButton}
                                onClick={handleToggleGroup}
                                disabled={!allowToolSelection}
                            >
                                {groupActionLabel}
                            </Button>
                        </div>
                        {groupToolList}
                    </PopoverSurface>
                </Popover>
            )}
            <Button
                size="small"
                appearance="transparent"
                icon={<Dismiss12Regular />}
                className={styles.dismissTrigger}
                onClick={handleDismissGroup}
                disabled={!allowToolSelection}
                aria-label={removeAriaLabel}
            />
        </div>
    );
};

export const ChatToolSelector = ({ tools, selectedTools, setSelectedTools, allowToolSelection = true }: ChatToolSelectorProps) => {
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

    const toggleGroupOpen = useCallback((groupName: string) => {
        setOpenGroups(prev => (prev.includes(groupName) ? prev.filter(name => name !== groupName) : [...prev, groupName]));
    }, []);

    const { groups, ungrouped } = useMemo(() => buildGroups(tools.tools), [tools.tools]);

    const activeBadges = useMemo((): ActiveBadge[] => {
        const badges: ActiveBadge[] = [];

        for (const group of groups) {
            const activeGroupTools = group.tools.filter(tool => selectedTools.includes(tool.id));
            if (activeGroupTools.length > 0) {
                badges.push({
                    type: "group",
                    groupName: group.name,
                    activeTools: activeGroupTools,
                    allGroupTools: group.tools
                });
            }
        }

        for (const tool of ungrouped) {
            if (selectedTools.includes(tool.id)) {
                badges.push({ type: "individual", tool });
            }
        }

        return badges;
    }, [groups, ungrouped, selectedTools]);

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
            const group = groups.find(item => item.name === groupName);
            if (!group) return;
            const groupIds = new Set(group.tools.map(tool => tool.id));
            setSelectedTools(prev => prev.filter(id => !groupIds.has(id)));
        },
        [groups, setSelectedTools, allowToolSelection]
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

    const openTutorial = useCallback((toolId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const route = TOOL_TUTORIAL_MAP[toolId];
        if (route) {
            window.open(`#${route}`, "_blank", "noopener,noreferrer");
        }
    }, []);

    const renderToolItem = useCallback(
        (tool: ToolInfo) => {
            const isSelected = selectedTools.includes(tool.id);
            const hasTutorial = !!TOOL_TUTORIAL_MAP[tool.id];

            return (
                <div key={tool.id} className={`${styles.toolItem} ${isSelected ? styles.toolItemSelected : ""}`}>
                    <button
                        type="button"
                        className={styles.toolItemToggle}
                        aria-pressed={isSelected}
                        onClick={() => toggleTool(tool.id)}
                        disabled={!allowToolSelection}
                    >
                        <span className={styles.toolItemContent}>
                            <span className={`${styles.statusDot} ${isSelected ? styles.statusDotActive : ""}`} aria-hidden="true" />
                            <span className={styles.toolItemTitleRow}>
                                <span className={styles.toolItemName}>{tool.name}</span>
                                {hasTutorial && (
                                    <Tooltip content={t("components.questioninput.tutorial_help")} relationship="label">
                                        <Button
                                            size="small"
                                            icon={<QuestionCircle16Regular />}
                                            appearance="transparent"
                                            className={styles.tutorialButton}
                                            onClick={event => openTutorial(tool.id, event)}
                                            aria-label={t("components.questioninput.tutorial_help_aria", { tool: tool.id })}
                                        />
                                    </Tooltip>
                                )}
                            </span>
                        </span>
                        <span className={styles.toolItemActions}>
                            <span className={`${styles.checkCircle} ${!isSelected ? styles.checkCircleHidden : ""}`} aria-hidden="true">
                                <Checkmark16Regular className={styles.checkIcon} />
                            </span>
                        </span>
                    </button>
                </div>
            );
        },
        [selectedTools, toggleTool, openTutorial, t]
    );

    return (
        <div className={styles.toolSelectorRow}>
            {activeBadges.length === 0 && <span className={styles.emptyStateBadge}>{t("components.questioninput.no_tools_active")}</span>}

            {visibleBadges.map(badge => {
                if (badge.type === "group") {
                    return (
                        <GroupBadgeItem
                            key={`group-${badge.groupName}`}
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

                return (
                    <button
                        type="button"
                        key={`tool-${badge.tool.id}`}
                        className={styles.activeBadge}
                        onClick={() => dismissIndividualTool(badge.tool.id)}
                        disabled={!allowToolSelection}
                        aria-label={t("components.questioninput.remove_tool_aria", { tool: badge.tool.name })}
                    >
                        <span className={styles.badgeLabel}>{badge.tool.name}</span>
                        <Dismiss12Regular className={styles.dismissIcon} aria-hidden="true" />
                    </button>
                );
            })}

            {overflowCount > 0 && <span className={styles.overflowBadge}>{t("components.questioninput.more_tools", { count: overflowCount })}</span>}

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
                    <Button ref={triggerRef} appearance="transparent" className={styles.addToolBadge} disabled={!allowToolSelection}>
                        {t("components.questioninput.add_tool")}
                    </Button>
                </PopoverTrigger>
                <PopoverSurface className={styles.popoverSurface}>
                    <div className={styles.popoverHeader}>{t("components.questioninput.available_tools")}</div>

                    {groups.length > 0 &&
                        groups.map(group => {
                            const groupIds = group.tools.map(tool => tool.id);
                            const selectedCount = groupIds.filter(id => selectedTools.includes(id)).length;
                            const allSelected = group.tools.length > 0 && selectedCount === group.tools.length;
                            const isOpen = openGroups.includes(group.name);
                            const groupActionLabel = allSelected ? t("components.questioninput.disable_all") : t("components.questioninput.enable_all");
                            const groupActionIcon = allSelected ? <Dismiss16Regular /> : <Checkmark16Regular />;

                            return (
                                <div key={group.name} className={styles.accordionGroup}>
                                    <div className={styles.accordionGroupHeader}>
                                        <button
                                            type="button"
                                            className={styles.accordionGroupToggle}
                                            onClick={() => toggleGroupOpen(group.name)}
                                            aria-expanded={isOpen}
                                            disabled={!allowToolSelection}
                                        >
                                            <span className={`${styles.statusDot} ${selectedCount > 0 ? styles.statusDotActive : ""}`} aria-hidden="true" />
                                            <span className={styles.groupTitleBlock}>
                                                <span className={styles.groupName}>{group.name}</span>
                                                <span className={styles.groupCount}>
                                                    {selectedCount}/{group.tools.length}
                                                </span>
                                            </span>
                                        </button>
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={groupActionIcon}
                                            className={styles.groupHeaderActionButton}
                                            onClick={event => {
                                                event.stopPropagation();
                                                toggleGroup(group.tools);
                                            }}
                                            disabled={!allowToolSelection}
                                        >
                                            {groupActionLabel}
                                        </Button>
                                        <button
                                            type="button"
                                            className={styles.groupChevronButton}
                                            onClick={event => {
                                                event.stopPropagation();
                                                toggleGroupOpen(group.name);
                                            }}
                                            aria-label={group.name}
                                            aria-expanded={isOpen}
                                            disabled={!allowToolSelection}
                                        >
                                            <ChevronDown16Regular
                                                className={`${styles.expandIcon} ${isOpen ? styles.expandIconOpen : ""}`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                    {isOpen && <div className={styles.groupToolsList}>{group.tools.map(renderToolItem)}</div>}
                                </div>
                            );
                        })}

                    {ungrouped.length > 0 && <div className={styles.ungroupedList}>{ungrouped.map(renderToolItem)}</div>}
                </PopoverSurface>
            </Popover>
        </div>
    );
};
