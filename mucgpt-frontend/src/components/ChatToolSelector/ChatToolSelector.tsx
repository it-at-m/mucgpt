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
import { Checkmark16Regular, QuestionCircle16Regular, Dismiss24Regular, LockClosed16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./ChatToolSelector.module.css";
import { ToolListResponse } from "../../api/models";
import { buildToolEntries, ToolEntry } from "../../utils/toolGroups";

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

interface ToolRowProps {
    tool: ToolEntry;
    isLocked?: boolean;
    isSelected?: boolean;
    allowToolSelection: boolean;
    onToggle?: (tool: ToolEntry) => void;
    onOpenTutorial: (toolId: string, event: React.MouseEvent) => void;
}

const ToolRow = ({ tool, isLocked = false, isSelected = false, allowToolSelection, onToggle, onOpenTutorial }: ToolRowProps) => {
    const { t } = useTranslation();
    const hasTutorial = !!TOOL_TUTORIAL_MAP[tool.id];
    const showActiveState = isLocked || isSelected;
    const toggleButtonRef = useRef<HTMLButtonElement>(null);

    const handleToolRowClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (isLocked || !allowToolSelection) return;

            const target = event.target as HTMLElement;
            if (target.closest(`.${styles.toolItemToggle}`) || target.closest(`.${styles.toolItemTutorialButton}`)) {
                return;
            }

            toggleButtonRef.current?.click();
        },
        [allowToolSelection, isLocked]
    );

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
            <div
                className={`${styles.toolItemMain} ${!isLocked && allowToolSelection ? styles.toolItemMainClickable : ""} ${!isLocked && !allowToolSelection ? styles.toolItemMainDisabled : ""}`}
                onClick={handleToolRowClick}
            >
                <div className={styles.toolItemInfoGroup}>
                    {isLocked ? (
                        <div className={styles.toolItemStatic}>{titleContent}</div>
                    ) : (
                        <Button
                            ref={toggleButtonRef}
                            appearance="transparent"
                            className={styles.toolItemToggle}
                            aria-pressed={isSelected}
                            onClick={() => onToggle?.(tool)}
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
    const [useDialogSelector, setUseDialogSelector] = useState(() =>
        typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 480px)").matches : false
    );
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [frozenTarget, setFrozenTarget] = useState<{ getBoundingClientRect: () => DOMRect } | null>(null);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(max-width: 480px)");
        const handler = (event: MediaQueryListEvent) => setUseDialogSelector(event.matches);
        setUseDialogSelector(mq.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        if (!allowToolSelection) {
            setPopoverOpen(false);
        }
    }, [allowToolSelection]);

    useEffect(() => {
        if (useDialogSelector) {
            setFrozenTarget(null);
        }
    }, [useDialogSelector]);

    const handlePopoverOpenChange = useCallback(
        (_: unknown, data: { open: boolean }) => {
            if (!useDialogSelector && data.open && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const frozenRect = new DOMRect(rect.left, rect.top, rect.width, rect.height);
                setFrozenTarget({ getBoundingClientRect: () => frozenRect });
            }

            if (!data.open || useDialogSelector) {
                setFrozenTarget(null);
            }

            setPopoverOpen(data.open);
        },
        [useDialogSelector]
    );

    const { lockedEntries, selectableEntries } = useMemo(() => {
        const lockedToolIdSet = new Set(lockedToolIds);
        const entries = buildToolEntries(tools.tools);
        const isLocked = (entry: ToolEntry) => entry.toolIds.some(id => lockedToolIdSet.has(id));

        return {
            lockedEntries: entries.filter(isLocked),
            selectableEntries: entries.filter(entry => !isLocked(entry))
        };
    }, [lockedToolIds, tools.tools]);

    const isEntrySelected = useCallback((entry: ToolEntry) => entry.toolIds.some(id => selectedTools.includes(id)), [selectedTools]);

    const activeBadges = useMemo(
        () => [
            ...lockedEntries.map(entry => ({ entry, isLocked: true })),
            ...selectableEntries.filter(isEntrySelected).map(entry => ({ entry, isLocked: false }))
        ],
        [isEntrySelected, lockedEntries, selectableEntries]
    );

    const visibleBadges = activeBadges.slice(0, MAX_VISIBLE_BADGES);
    const overflowCount = Math.max(0, activeBadges.length - MAX_VISIBLE_BADGES);

    const toggleEntry = useCallback(
        (entry: ToolEntry) => {
            if (!allowToolSelection) return;
            setSelectedTools(prev =>
                entry.toolIds.some(id => prev.includes(id)) ? prev.filter(id => !entry.toolIds.includes(id)) : [...prev, ...entry.toolIds]
            );
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
    const lockedBadgeLabel = t("components.questioninput.assistant_tool_locked");

    const selectorContent = (
        <>
            <div className={styles.popoverHeader}>{t("components.questioninput.available_tools")}</div>

            {lockedEntries.length > 0 && (
                <>
                    <div className={styles.popoverSectionHeader}>{t("components.questioninput.assistant_tools_section")}</div>
                    <div className={styles.toolList}>
                        {lockedEntries.map(entry => (
                            <ToolRow key={entry.id} tool={entry} isLocked allowToolSelection={allowToolSelection} onOpenTutorial={openTutorial} />
                        ))}
                    </div>
                    <div className={styles.popoverSectionHeader}>{t("components.questioninput.optional_tools_section")}</div>
                </>
            )}

            {selectableEntries.length > 0 && (
                <div className={styles.toolList}>
                    {selectableEntries.map(entry => (
                        <ToolRow
                            key={entry.id}
                            tool={entry}
                            isSelected={isEntrySelected(entry)}
                            allowToolSelection={allowToolSelection}
                            onToggle={toggleEntry}
                            onOpenTutorial={openTutorial}
                        />
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div className={styles.toolSelectorRow}>
            {activeBadges.length === 0 && <span className={styles.emptyStateBadge}>{t("components.questioninput.no_tools_active")}</span>}

            {visibleBadges.map(({ entry, isLocked }) =>
                isLocked ? (
                    <Tooltip key={entry.id} content={lockedBadgeLabel} relationship="label">
                        <span className={styles.lockedBadge}>
                            <LockClosed16Regular className={styles.lockedBadgeIcon} aria-hidden="true" />
                            <span className={styles.badgeLabel}>{entry.name}</span>
                        </span>
                    </Tooltip>
                ) : (
                    <Button
                        key={entry.id}
                        appearance="secondary"
                        className={styles.activeBadge}
                        onClick={() => toggleEntry(entry)}
                        disabled={!allowToolSelection}
                        aria-label={t("components.questioninput.remove_tool_aria", { tool: entry.name })}
                    >
                        <span className={styles.badgeLabel}>{entry.name}</span>
                    </Button>
                )
            )}

            {overflowCount > 0 && <span className={styles.overflowBadge}>{t("components.questioninput.more_tools", { count: overflowCount })}</span>}

            {selectableEntries.length > 0 &&
                (useDialogSelector ? (
                    <Dialog open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
                        <DialogTrigger disableButtonEnhancement>
                            <Button ref={triggerRef} shape="circular" appearance="primary" className={styles.addToolBadge} disabled={!allowToolSelection}>
                                {t("components.questioninput.add_tool")}
                            </Button>
                        </DialogTrigger>
                        <DialogSurface className={styles.selectorDialogSurface}>
                            <DialogBody className={styles.selectorDialogBody}>
                                <DialogTitle
                                    action={
                                        <DialogTrigger action="close">
                                            <Button appearance="subtle" aria-label={t("common.close")} icon={<Dismiss24Regular />} />
                                        </DialogTrigger>
                                    }
                                >
                                    {t("components.questioninput.available_tools")}
                                </DialogTitle>
                                <DialogContent className={styles.selectorDialogContent}>{selectorContent}</DialogContent>
                            </DialogBody>
                        </DialogSurface>
                    </Dialog>
                ) : (
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
                        <PopoverSurface className={styles.popoverSurface}>{selectorContent}</PopoverSurface>
                    </Popover>
                ))}
        </div>
    );
};
