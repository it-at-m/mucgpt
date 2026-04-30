import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Spinner, Tab, TabList, Tooltip } from "@fluentui/react-components";
import {
    Delete20Regular,
    Edit20Regular,
    MoreHorizontal20Regular,
    Pin20Filled,
    Pin20Regular,
    PinOff20Regular,
    Globe20Regular,
    Bot20Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useUnifiedHistory } from "./UnifiedHistoryContext";
import { UnifiedHistoryEntry, UnifiedHistoryStorage } from "./unifiedHistoryStorage";
import { CloseConfirmationDialog } from "../AssistantDialogs/shared/CloseConfirmationDialog";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import styles from "./UnifiedSidebarHistory.module.css";

const HISTORY_TAB_STORAGE_KEY = "UNIFIED_HISTORY_ASSISTANT_TAB";
const DELETE_DIALOG_TITLE_MAX_LENGTH = 80;

type HistoryTab = "all" | "assistant";

const storage = new UnifiedHistoryStorage();

interface UnifiedSidebarHistoryProps {
    requestClose?: () => void;
}

export const UnifiedSidebarHistory = ({ requestClose }: UnifiedSidebarHistoryProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pageContext, refreshVersion, refreshHistory } = useUnifiedHistory();
    const { showError, showSuccess } = useGlobalToastContext();
    const [entries, setEntries] = useState<UnifiedHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const hasLoadedRef = useRef(false);
    const [entryToDelete, setEntryToDelete] = useState<UnifiedHistoryEntry | null>(null);
    const [tab, setTab] = useState<HistoryTab>(() => {
        const stored = localStorage.getItem(HISTORY_TAB_STORAGE_KEY);
        return stored === "assistant" ? "assistant" : "all";
    });

    const isAssistantContext = pageContext?.kind === "assistant";
    const activeChatId = pageContext?.activeChatId;

    const getEntryTitle = useCallback((entry?: UnifiedHistoryEntry | null) => entry?.name || t("components.history.unnamed_chat"), [t]);

    const getDialogTitle = useCallback(
        (entry?: UnifiedHistoryEntry | null) => {
            const title = getEntryTitle(entry);
            if (title.length <= DELETE_DIALOG_TITLE_MAX_LENGTH) {
                return title;
            }

            return `${title.slice(0, DELETE_DIALOG_TITLE_MAX_LENGTH - 1)}…`;
        },
        [getEntryTitle]
    );

    const loadHistory = useCallback(async () => {
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        try {
            setEntries(await storage.getAllHistoryEntries());
        } finally {
            setIsLoading(false);
            hasLoadedRef.current = true;
            setHasLoaded(true);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory, refreshVersion]);

    const assistantEntries = useMemo(
        () => (isAssistantContext ? entries.filter(entry => entry.kind === "assistant" && entry.assistantId === pageContext.assistantId) : []),
        [entries, isAssistantContext, pageContext]
    );

    const effectiveTab = isAssistantContext ? tab : "all";
    const visibleEntries = effectiveTab === "assistant" ? assistantEntries : entries;

    const handleTabChange = (_event: unknown, data: { value: unknown }) => {
        const nextTab = data.value === "assistant" ? "assistant" : "all";
        setTab(nextTab);
        localStorage.setItem(HISTORY_TAB_STORAGE_KEY, nextTab);
    };

    const navigateToEntry = async (entry: UnifiedHistoryEntry) => {
        if (entry.kind === "chat") {
            navigate(`/chat?chatId=${encodeURIComponent(entry.id)}`);
            requestClose?.();
            return;
        }

        if (!entry.assistantId) {
            return;
        }

        const hasLocalConfig = await storage.hasLocalAssistantConfig(entry.assistantId);
        const assistantPath = hasLocalConfig ? `/assistant/${entry.assistantId}` : `/communityassistant/${entry.assistantId}`;
        navigate(`${assistantPath}?chatId=${encodeURIComponent(entry.id)}`);
        requestClose?.();
    };

    const deleteEntry = async (entry: UnifiedHistoryEntry) => {
        const deletedTitle = getEntryTitle(entry);
        const isDeletingActiveChat = activeChatId === entry.id;
        try {
            await storage.deleteEntry(entry);
            refreshHistory();
            setEntryToDelete(null);
            showSuccess(t("components.history.delete_success_title"), t("components.history.delete_success_message", { name: deletedTitle }));

            if (isDeletingActiveChat) {
                pageContext?.resetActiveChat?.(entry.id);
                navigate("/");
                requestClose?.();
            }
        } catch (error) {
            console.error("Failed to delete history entry", error);
            showError(t("components.history.delete_failed_title"), t("components.history.delete_failed_message", { name: deletedTitle }));
        }
    };

    const renameEntry = async (entry: UnifiedHistoryEntry) => {
        const newName = prompt(t("components.history.newchat"), entry.name ?? "");
        const trimmedName = newName?.trim();
        if (!trimmedName) {
            return;
        }

        try {
            await storage.renameEntry(entry, trimmedName);
            refreshHistory();
        } catch (error) {
            console.error("Failed to rename history entry", error);
            showError(t("components.history.rename_failed_title"), t("components.history.rename_failed_message"));
        }
    };

    const changeFavourite = async (entry: UnifiedHistoryEntry, favorite: boolean) => {
        try {
            await storage.changeFavourite(entry, favorite);
            refreshHistory();
        } catch (error) {
            console.error("Failed to update history entry favourite state", error);
            showError(t("components.history.favorite_failed_title"), t("components.history.favorite_failed_message"));
        }
    };

    if (isLoading && !hasLoaded) {
        return (
            <div className={styles.centerState}>
                <Spinner size="tiny" label={t("components.history.loading")} />
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.historyLabel}>{t("components.history.recents_label")}</div>
            {isAssistantContext && (
                <TabList selectedValue={tab} onTabSelect={handleTabChange} className={styles.tabs} size="small">
                    <Tab value="all" icon={<Globe20Regular />}>
                        {t("components.history.all_chats")}
                    </Tab>
                    <Tab value="assistant" icon={<Bot20Regular />}>
                        {t("components.history.current_assistant")}
                    </Tab>
                </TabList>
            )}

            {visibleEntries.length === 0 ? (
                <div className={styles.emptyState}>{t(effectiveTab === "assistant" ? "components.history.empty_assistant" : "components.history.empty")}</div>
            ) : (
                <div className={styles.list} role="list" aria-label={t("components.history.history")}>
                    {visibleEntries.map(entry => {
                        const isActive = activeChatId === entry.id;
                        const title = entry.name || t("components.history.unnamed_chat");

                        return (
                            <div key={`${entry.kind}-${entry.id}`} className={`${styles.row} ${isActive ? styles.rowActive : ""}`} role="listitem">
                                <Tooltip content={title} relationship="description" positioning={{ position: "after", offset: 40 }}>
                                    <Button
                                        appearance="subtle"
                                        className={styles.chatButton}
                                        onClick={() => void navigateToEntry(entry)}
                                        aria-current={isActive ? "page" : undefined}
                                    >
                                        <span className={styles.chatButtonContent}>
                                            {entry.favorite && <Pin20Filled className={styles.pinnedIcon} />}
                                            <span className={styles.chatName}>{title}</span>
                                        </span>
                                    </Button>
                                </Tooltip>

                                <div className={styles.optionsSlot}>
                                    <Menu>
                                        <MenuTrigger disableButtonEnhancement>
                                            <Button
                                                icon={<MoreHorizontal20Regular />}
                                                appearance="subtle"
                                                size="small"
                                                className={styles.optionsButton}
                                                aria-label={t("components.history.options")}
                                            />
                                        </MenuTrigger>
                                        <MenuPopover className={styles.menuPopover}>
                                            <MenuList className={styles.menuList}>
                                                <MenuItem icon={<Delete20Regular />} onClick={() => setEntryToDelete(entry)} className={styles.deleteMenuItem}>
                                                    {t("components.history.delete")}
                                                </MenuItem>
                                                <MenuItem icon={<Edit20Regular />} onClick={() => void renameEntry(entry)}>
                                                    {t("components.history.rename")}
                                                </MenuItem>
                                                <MenuItem
                                                    icon={entry.favorite ? <PinOff20Regular /> : <Pin20Regular />}
                                                    onClick={() => void changeFavourite(entry, !entry.favorite)}
                                                >
                                                    {entry.favorite ? t("components.history.unpin_chat") : t("components.history.pin_chat")}
                                                </MenuItem>
                                            </MenuList>
                                        </MenuPopover>
                                    </Menu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <CloseConfirmationDialog
                open={entryToDelete !== null}
                onOpenChange={open => {
                    if (!open) {
                        setEntryToDelete(null);
                    }
                }}
                onConfirmClose={() => {
                    if (entryToDelete) {
                        void deleteEntry(entryToDelete);
                    }
                }}
                title={t("components.history.delete_confirm_title")}
                message={t("components.history.delete_confirm_message", {
                    name: getDialogTitle(entryToDelete)
                })}
                confirmLabel={t("components.history.delete")}
                confirmIntent="danger"
            />
        </div>
    );
};
