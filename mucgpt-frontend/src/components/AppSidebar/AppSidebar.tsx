import { Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, Tooltip } from "@fluentui/react-components";
import {
    Bot24Regular,
    ChatAdd24Regular,
    Chat24Regular,
    ChatHistory24Regular,
    ChevronLeft24Regular,
    ChevronRight24Regular,
    CompassNorthwest24Regular,
    Sparkle24Regular
} from "@fluentui/react-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUnifiedHistory, UnifiedHistoryStorage } from "../UnifiedHistory";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import { UserSidebarProfile } from "../UserSidebarProfile/UserSidebarProfile";
import styles from "./AppSidebar.module.css";

interface AppSidebarProps {
    collapsed: boolean;
    isMobile: boolean;
    onToggleCollapsed?: () => void;
    onNavigate?: () => void;
    secondaryContent?: ReactNode | null;
    secondaryTitle?: string | null;
    utilitiesContent?: ReactNode | null;
    logoSrc: string;
    appTitle: string;
    appTitleAriaLabel: string;
}

interface NavigationItem {
    id: string;
    kind: "link" | "action";
    label: string;
    ariaLabel: string;
    to?: string;
    icon: ReactElement;
    isActive: boolean;
}

interface RecentAssistant {
    id: string;
    title: string;
    basePath: string;
}

const isAssistantRoute = (pathname: string) => {
    const normalizedPathname = pathname.replace(/\/+$/, "");

    return (
        normalizedPathname === "/discovery" ||
        normalizedPathname.startsWith("/discovery/") ||
        normalizedPathname.startsWith("/assistant/") ||
        normalizedPathname.startsWith("/communityassistant/") ||
        normalizedPathname.startsWith("/owned/communityassistant/") ||
        normalizedPathname.startsWith("/deleted/communityassistant/")
    );
};

export const AppSidebar = ({
    collapsed,
    isMobile,
    onToggleCollapsed,
    onNavigate,
    secondaryContent = null,
    secondaryTitle = null,
    utilitiesContent = null,
    logoSrc,
    appTitle,
    appTitleAriaLabel
}: AppSidebarProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { pageContext } = useUnifiedHistory();
    const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
    const [recentAssistant, setRecentAssistant] = useState<RecentAssistant | null>(null);
    const historyStorage = useMemo(() => new UnifiedHistoryStorage(), []);
    const assistantStorageService = useMemo(() => new AssistantStorageService(ASSISTANT_STORE), []);
    const communityAssistantStorageService = useMemo(() => new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE), []);
    const isCurrentAssistantChatRoute =
        pageContext?.kind === "assistant" &&
        (/^\/assistant\/[^/]+$/.test(location.pathname) ||
            /^\/communityassistant\/[^/]+$/.test(location.pathname) ||
            /^\/owned\/communityassistant\/[^/]+$/.test(location.pathname));

    const navigationItems = useMemo<NavigationItem[]>(
        () => [
            {
                id: "new-chat",
                kind: "action",
                label: t("app_sidebar.new_chat"),
                ariaLabel: t("app_sidebar.start_new_chat"),
                to: "/chat?new=1",
                icon: <ChatAdd24Regular className={styles.navIcon} />,
                isActive: false
            },
            {
                id: "assistants",
                kind: "link",
                label: t("app_sidebar.assistants"),
                ariaLabel: t("app_sidebar.go_assistants"),
                to: "/discovery",
                icon: <Bot24Regular className={styles.navIcon} />,
                isActive: isAssistantRoute(location.pathname)
            }
        ],
        [location.pathname, t]
    );

    const handleNavigate = (to: string) => {
        const target = to === "/chat?new=1" ? `/chat?new=${Date.now()}` : to;
        navigate(target);
        onNavigate?.();
    };

    const handleNewChatOption = (to: string) => {
        navigate(to);
        setIsNewChatDialogOpen(false);
        onNavigate?.();
    };

    const handlePlainChat = () => handleNewChatOption(`/chat?new=${Date.now()}`);
    const handleCurrentAssistantChat = () => handleNewChatOption(`${location.pathname}?new=${Date.now()}`);
    const handleDiscoverAssistants = () => handleNewChatOption("/discovery");
    const handleAssistantPathChat = (basePath: string) => handleNewChatOption(`${basePath}?new=${Date.now()}`);
    const handleRecentAssistantChat = () => {
        if (recentAssistant) {
            handleAssistantPathChat(recentAssistant.basePath);
        }
    };
    const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, action: () => void) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        action();
    };

    const loadRecentAssistant = useCallback(async (): Promise<RecentAssistant | null> => {
        const entries = await historyStorage.getAllHistoryEntries();
        const latestAssistantEntry = entries
            .filter(entry => entry.kind === "assistant" && entry.assistantId)
            .toSorted((a, b) => b.lastEdited - a.lastEdited)[0];

        if (!latestAssistantEntry?.assistantId) {
            return null;
        }

        const assistantId = latestAssistantEntry.assistantId;
        const localAssistant = await assistantStorageService.getAssistantConfig(assistantId);
        if (localAssistant) {
            return {
                id: assistantId,
                title: localAssistant.title || t("app_sidebar.new_chat_recent_assistant_fallback"),
                basePath: `/assistant/${assistantId}`
            };
        }

        const communityAssistant = await communityAssistantStorageService.getAssistantConfig(assistantId);
        return {
            id: assistantId,
            title: communityAssistant?.title || t("app_sidebar.new_chat_recent_assistant_fallback"),
            basePath: `/communityassistant/${assistantId}`
        };
    }, [assistantStorageService, communityAssistantStorageService, historyStorage, t]);

    useEffect(() => {
        if (!isNewChatDialogOpen) {
            return;
        }

        if (isCurrentAssistantChatRoute) {
            return;
        }

        let isCurrent = true;
        setRecentAssistant(null);
        loadRecentAssistant()
            .then(assistant => {
                if (isCurrent) {
                    setRecentAssistant(assistant);
                }
            })
            .catch(error => {
                console.error("Failed to load recent assistant", error);
                if (isCurrent) {
                    setRecentAssistant(null);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [isCurrentAssistantChatRoute, isNewChatDialogOpen, loadRecentAssistant]);

    const desktopToggleEnabled = !isMobile && !!onToggleCollapsed;
    const toggleLabel = t("app_sidebar.toggle_navigation");
    const resizeLabel = t("app_sidebar.resize_navigation");
    const toggleInteractiveClassName = desktopToggleEnabled ? styles.resizeCursor : "";
    const useCollapsedLogoToggle = collapsed && !isMobile && !!onToggleCollapsed;
    return (
        <div className={styles.root}>
            <div className={`${styles.body} ${collapsed && !isMobile ? styles.bodyCollapsed : ""}`}>
                {desktopToggleEnabled && (
                    <button
                        type="button"
                        className={`${styles.edgeHandle} ${toggleInteractiveClassName}`}
                        onClick={onToggleCollapsed}
                        aria-label={resizeLabel}
                        title={resizeLabel}
                    />
                )}

                <div className={styles.content}>
                    <div className={`${styles.brandHeader} ${collapsed && !isMobile ? styles.brandHeaderCollapsed : ""}`}>
                        <Tooltip content={appTitle} relationship="description" positioning="after">
                            {useCollapsedLogoToggle ? (
                                <button
                                    type="button"
                                    className={`${styles.brandLink} ${styles.brandLinkCollapsed} ${styles.brandToggleButton}`}
                                    aria-label={toggleLabel}
                                    onClick={onToggleCollapsed}
                                >
                                    <img src={logoSrc} alt="" className={styles.brandLogo} />
                                    <span className={styles.brandToggleOverlay} aria-hidden="true">
                                        <ChevronRight24Regular />
                                    </span>
                                </button>
                            ) : (
                                <Link
                                    to="/"
                                    className={`${styles.brandLink} ${collapsed && !isMobile ? styles.brandLinkCollapsed : ""}`}
                                    aria-label={t("common.home_link", "Zur Startseite")}
                                    onClick={() => onNavigate?.()}
                                >
                                    <img src={logoSrc} alt="MUCGPT" className={styles.brandLogo} />
                                    {(!collapsed || isMobile) && (
                                        <span className={styles.brandTitle} aria-label={appTitleAriaLabel}>
                                            {appTitle}
                                        </span>
                                    )}
                                </Link>
                            )}
                        </Tooltip>
                        {onToggleCollapsed && !useCollapsedLogoToggle && (
                            <Tooltip content={toggleLabel} relationship="description" positioning="after">
                                <Button
                                    appearance="subtle"
                                    className={`${styles.topCollapseButton} ${collapsed && !isMobile ? styles.topCollapseButtonCollapsed : ""}`}
                                    icon={collapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
                                    aria-label={toggleLabel}
                                    onClick={onToggleCollapsed}
                                />
                            </Tooltip>
                        )}
                    </div>

                    <nav className={styles.navGroup}>
                        {navigationItems.map(item => {
                            const navItemClassName = `${styles.navButton} ${collapsed && !isMobile ? styles.navButtonCollapsed : ""} ${
                                item.isActive ? styles.navButtonActive : ""
                            }`;

                            const navItem =
                                item.kind === "link" && item.to ? (
                                    <Link
                                        key={item.id}
                                        to={item.to}
                                        className={navItemClassName}
                                        aria-label={item.ariaLabel}
                                        aria-current={item.isActive ? "page" : undefined}
                                        onClick={() => onNavigate?.()}
                                    >
                                        {item.icon}
                                        {(!collapsed || isMobile) && item.label}
                                    </Link>
                                ) : (
                                    <Button
                                        key={item.id}
                                        appearance="subtle"
                                        icon={item.icon}
                                        className={navItemClassName}
                                        aria-label={item.ariaLabel}
                                        aria-current={item.isActive ? "page" : undefined}
                                        onClick={() => (item.id === "new-chat" ? setIsNewChatDialogOpen(true) : item.to && handleNavigate(item.to))}
                                    >
                                        {(!collapsed || isMobile) && item.label}
                                    </Button>
                                );

                            return collapsed && !isMobile ? (
                                <Tooltip key={item.id} content={item.label} relationship="description" positioning="after">
                                    {navItem}
                                </Tooltip>
                            ) : (
                                navItem
                            );
                        })}
                    </nav>

                    {secondaryContent && secondaryTitle && (!collapsed || isMobile) && (
                        <div className={styles.secondaryGroup}>
                            <div className={styles.sectionDivider} aria-hidden="true" />
                            <section className={styles.secondarySection} aria-label={secondaryTitle}>
                                <div className={styles.secondaryPanelContent}>{secondaryContent}</div>
                            </section>
                        </div>
                    )}

                    {secondaryContent && secondaryTitle && collapsed && !isMobile && onToggleCollapsed && (
                        <div className={styles.collapsedSecondaryGroup}>
                            <div className={styles.sectionDivider} aria-hidden="true" />
                            <Tooltip content={t("components.history.show_history")} relationship="description" positioning="after">
                                <Button
                                    appearance="subtle"
                                    icon={<ChatHistory24Regular />}
                                    className={styles.collapsedSecondaryButton}
                                    aria-label={t("components.history.show_history")}
                                    onClick={onToggleCollapsed}
                                />
                            </Tooltip>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {utilitiesContent && (
                        <div className={styles.footerSection}>
                            <div className={styles.sectionDivider} aria-hidden="true" />
                            <UserSidebarProfile
                                collapsed={collapsed}
                                isMobile={isMobile}
                                utilitiesContent={utilitiesContent}
                                utilitiesLabel={t("app_sidebar.preferences_and_help")}
                                popoverClassName={styles.settingsPopover}
                                utilitiesContentClassName={styles.utilitiesContent}
                            />
                        </div>
                    )}
                </div>
            </div>
            <Dialog open={isNewChatDialogOpen} onOpenChange={(_event, data) => setIsNewChatDialogOpen(data.open)}>
                <DialogSurface className={styles.newChatDialogSurface} aria-label={t("app_sidebar.start_new_chat")}>
                    <DialogBody>
                        <DialogContent className={styles.newChatDialogContent}>
                            <p className={styles.newChatDialogSubtitle}>{t("app_sidebar.new_chat_dialog_subtitle")}</p>
                            <div className={styles.newChatCards}>
                                {isCurrentAssistantChatRoute ? (
                                    <Card
                                        appearance="outline"
                                        size="large"
                                        className={styles.newChatCard}
                                        onClick={handleCurrentAssistantChat}
                                        onKeyDown={event => handleCardKeyDown(event, handleCurrentAssistantChat)}
                                        role="button"
                                    >
                                        <span className={styles.newChatCardIcon}>
                                            <Sparkle24Regular />
                                        </span>
                                        <span className={styles.newChatCardBody}>
                                            <span className={styles.newChatCardTitle}>
                                                {t("app_sidebar.new_chat_recent_assistant_title", {
                                                    assistantName:
                                                        pageContext?.kind === "assistant"
                                                            ? (pageContext.assistantTitle ?? t("app_sidebar.new_chat_recent_assistant_fallback"))
                                                            : t("app_sidebar.new_chat_recent_assistant_fallback")
                                                })}
                                            </span>
                                        </span>
                                    </Card>
                                ) : (
                                    <Card
                                        appearance="outline"
                                        size="large"
                                        className={styles.newChatCard}
                                        onClick={handlePlainChat}
                                        onKeyDown={event => handleCardKeyDown(event, handlePlainChat)}
                                        role="button"
                                    >
                                        <span className={styles.newChatCardIcon}>
                                            <Chat24Regular />
                                        </span>
                                        <span className={styles.newChatCardBody}>
                                            <span className={styles.newChatCardTitle}>{t("app_sidebar.new_chat_default_primary")}</span>
                                        </span>
                                    </Card>
                                )}

                                {isCurrentAssistantChatRoute ? (
                                    <Card
                                        appearance="outline"
                                        size="large"
                                        className={styles.newChatCard}
                                        onClick={handlePlainChat}
                                        onKeyDown={event => handleCardKeyDown(event, handlePlainChat)}
                                        role="button"
                                    >
                                        <span className={styles.newChatCardIcon}>
                                            <Chat24Regular />
                                        </span>
                                        <span className={styles.newChatCardBody}>
                                            <span className={styles.newChatCardTitle}>{t("app_sidebar.new_chat_plain_title")}</span>
                                        </span>
                                    </Card>
                                ) : recentAssistant ? (
                                    <Card
                                        appearance="outline"
                                        size="large"
                                        className={styles.newChatCard}
                                        onClick={handleRecentAssistantChat}
                                        onKeyDown={event => handleCardKeyDown(event, handleRecentAssistantChat)}
                                        role="button"
                                    >
                                        <span className={styles.newChatCardIcon}>
                                            <Sparkle24Regular />
                                        </span>
                                        <span className={styles.newChatCardBody}>
                                            <span className={styles.newChatCardTitle}>
                                                {t("app_sidebar.new_chat_recent_assistant_title", { assistantName: recentAssistant.title })}
                                            </span>
                                        </span>
                                    </Card>
                                ) : (
                                    <Card
                                        appearance="outline"
                                        size="large"
                                        className={styles.newChatCard}
                                        onClick={handleDiscoverAssistants}
                                        onKeyDown={event => handleCardKeyDown(event, handleDiscoverAssistants)}
                                        role="button"
                                    >
                                        <span className={styles.newChatCardIcon}>
                                            <CompassNorthwest24Regular />
                                        </span>
                                        <span className={styles.newChatCardBody}>
                                            <span className={styles.newChatCardTitle}>{t("app_sidebar.new_chat_discovery_card_title")}</span>
                                        </span>
                                    </Card>
                                )}
                            </div>
                            {(isCurrentAssistantChatRoute || recentAssistant) && (
                                <Button
                                    appearance="subtle"
                                    className={styles.newChatSecondaryAction}
                                    icon={<CompassNorthwest24Regular />}
                                    onClick={handleDiscoverAssistants}
                                >
                                    {t("app_sidebar.new_chat_discovery_title")}
                                </Button>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="subtle" onClick={() => setIsNewChatDialogOpen(false)}>
                                {t("common.cancel")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
