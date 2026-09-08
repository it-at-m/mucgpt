import {
    Avatar,
    Body1,
    Body1Strong,
    Button,
    Card,
    CardHeader,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    Tooltip
} from "@fluentui/react-components";
import {
    Bot20Regular,
    ChatAdd20Regular,
    Chat24Regular,
    ChevronLeft24Regular,
    ChevronRight24Regular,
    CompassNorthwest24Regular,
    Dismiss24Regular,
    Sparkle24Regular
} from "@fluentui/react-icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUnifiedHistory, UnifiedHistoryStorage } from "../UnifiedHistory";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE } from "../../constants";
import { UserSidebarProfile } from "../UserSidebarProfile/UserSidebarProfile";
import styles from "./AppSidebar.module.css";
import itemStyles from "./SidebarItem.module.css";

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

const isPlainLeftClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

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
    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
    const handleTooltipVisibility = (id: string, visible: boolean) => {
        setVisibleTooltip(current => (visible ? id : current === id ? null : current));
    };
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
                icon: <ChatAdd20Regular />,
                isActive: false
            },
            {
                id: "assistants",
                kind: "link",
                label: t("app_sidebar.assistants"),
                ariaLabel: t("app_sidebar.go_assistants"),
                to: "/discovery",
                icon: <Bot20Regular />,
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

    const handleNavLinkClick = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
        if (!isPlainLeftClick(event)) {
            return;
        }
        event.preventDefault();
        handleNavigate(to);
    };

    const handleHomeClick = (event: MouseEvent<HTMLElement>) => {
        if (!isPlainLeftClick(event)) {
            return;
        }
        event.preventDefault();
        navigate("/");
        onNavigate?.();
    };

    // Clicking empty space in the collapsed rail also expands it; clicks on
    // real controls (buttons/links) are left to their own handlers.
    const handleBodyClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!useCollapsedLogoToggle) {
            return;
        }
        if ((event.target as HTMLElement).closest("button, a")) {
            return;
        }
        onToggleCollapsed?.();
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

    const isCollapsed = collapsed && !isMobile;
    const brandButtonRef = useRef<HTMLAnchorElement>(null);
    const restoreToggleFocusRef = useRef(false);
    const handleToggleCollapsed = () => {
        restoreToggleFocusRef.current = true;
        setVisibleTooltip(null);
        onToggleCollapsed?.();
    };

    useEffect(() => {
        if (restoreToggleFocusRef.current) {
            brandButtonRef.current?.focus();
            restoreToggleFocusRef.current = false;
        }
    }, [isCollapsed]);
    const toggleLabel = isCollapsed ? t("app_sidebar.open_navigation") : t("app_sidebar.close_navigation");
    const useCollapsedLogoToggle = collapsed && !isMobile && !!onToggleCollapsed;
    return (
        <div className={`${styles.root} ${isMobile ? styles.rootMobile : ""}`}>
            <div
                className={`${styles.body} ${useCollapsedLogoToggle ? styles.bodyExpandable : ""}`}
                onClick={useCollapsedLogoToggle ? handleBodyClick : undefined}
            >
                <div className={styles.content}>
                    <div className={styles.brandHeader}>
                        <Tooltip
                            content={toggleLabel}
                            relationship="description"
                            positioning="after"
                            visible={useCollapsedLogoToggle && visibleTooltip === "brand"}
                            onVisibleChange={(_, data) => handleTooltipVisibility("brand", data.visible)}
                        >
                            <Button
                                ref={brandButtonRef}
                                as="a"
                                href={useCollapsedLogoToggle ? undefined : "/"}
                                appearance={isCollapsed ? "subtle" : "transparent"}
                                size="large"
                                className={`${itemStyles.control} ${styles.brandButton} ${isCollapsed ? itemStyles.collapsed : ""}`}
                                icon={{
                                    className: itemStyles.icon,
                                    children: (
                                        <span className={styles.brandMark} aria-hidden="true">
                                            <img src={logoSrc} alt="" className={styles.brandLogo} />
                                            <ChevronRight24Regular className={styles.brandExpandIcon} />
                                        </span>
                                    )
                                }}
                                aria-label={useCollapsedLogoToggle ? toggleLabel : t("common.home_link", "Zur Startseite")}
                                aria-expanded={useCollapsedLogoToggle ? false : undefined}
                                onClick={event => {
                                    if (useCollapsedLogoToggle) {
                                        event.preventDefault();
                                        handleToggleCollapsed();
                                    } else {
                                        handleHomeClick(event);
                                    }
                                }}
                            >
                                <span className={itemStyles.label} aria-hidden={isCollapsed}>
                                    <span className={`${itemStyles.text} ${styles.brandTitle}`} aria-label={appTitleAriaLabel}>
                                        {appTitle}
                                    </span>
                                </span>
                            </Button>
                        </Tooltip>
                        {onToggleCollapsed && (
                            <Tooltip
                                content={toggleLabel}
                                relationship="description"
                                positioning="after"
                                visible={!isCollapsed && visibleTooltip === "collapse"}
                                onVisibleChange={(_, data) => handleTooltipVisibility("collapse", data.visible)}
                            >
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    className={`${styles.topCollapseButton} ${isCollapsed ? styles.topCollapseButtonHidden : ""}`}
                                    icon={isMobile ? <Dismiss24Regular /> : <ChevronLeft24Regular />}
                                    aria-label={toggleLabel}
                                    aria-expanded={true}
                                    aria-hidden={isCollapsed}
                                    tabIndex={isCollapsed ? -1 : undefined}
                                    onClick={handleToggleCollapsed}
                                />
                            </Tooltip>
                        )}
                    </div>

                    <nav className={styles.navGroup}>
                        {navigationItems.map(item => {
                            const navItemClassName = `${itemStyles.control} ${styles.navButton} ${item.isActive ? styles.navButtonActive : ""} ${isCollapsed ? itemStyles.collapsed : ""}`;
                            const navLabel = (
                                <span className={itemStyles.label} aria-hidden={isCollapsed}>
                                    <span className={itemStyles.text}>{item.label}</span>
                                </span>
                            );
                            const icon = { className: `${itemStyles.icon} ${styles.navIcon}`, children: item.icon };
                            const navItem =
                                item.kind === "link" && item.to ? (
                                    <Button
                                        as="a"
                                        href={item.to}
                                        appearance="subtle"
                                        icon={icon}
                                        className={navItemClassName}
                                        aria-label={item.ariaLabel}
                                        aria-current={item.isActive ? "page" : undefined}
                                        onClick={event => handleNavLinkClick(event, item.to!)}
                                    >
                                        {navLabel}
                                    </Button>
                                ) : (
                                    <Button
                                        appearance="subtle"
                                        icon={icon}
                                        className={navItemClassName}
                                        aria-label={item.ariaLabel}
                                        onClick={() => (item.id === "new-chat" ? setIsNewChatDialogOpen(true) : item.to && handleNavigate(item.to))}
                                    >
                                        {navLabel}
                                    </Button>
                                );

                            return (
                                <Tooltip
                                    key={item.id}
                                    content={item.label}
                                    relationship="description"
                                    positioning="after"
                                    visible={isCollapsed && visibleTooltip === item.id}
                                    onVisibleChange={(_, data) => handleTooltipVisibility(item.id, data.visible)}
                                >
                                    {navItem}
                                </Tooltip>
                            );
                        })}
                    </nav>

                    {secondaryContent && secondaryTitle && (
                        <div className={styles.secondaryGroup} hidden={collapsed && !isMobile}>
                            <section className={styles.secondarySection} aria-label={secondaryTitle}>
                                <div className={styles.secondaryPanelContent}>{secondaryContent}</div>
                            </section>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {utilitiesContent && (
                        <div className={styles.footerSection}>
                            <UserSidebarProfile
                                collapsed={collapsed}
                                isMobile={isMobile}
                                utilitiesContent={utilitiesContent}
                                popoverClassName={styles.settingsPopover}
                            />
                        </div>
                    )}
                </div>
            </div>
            <Dialog open={isNewChatDialogOpen} onOpenChange={(_event, data) => setIsNewChatDialogOpen(data.open)}>
                <DialogSurface aria-label={t("app_sidebar.start_new_chat")}>
                    <DialogBody>
                        <DialogContent className={styles.newChatDialogContent}>
                            <Body1 className={styles.newChatDialogSubtitle}>{t("app_sidebar.new_chat_dialog_subtitle")}</Body1>
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
                                        <CardHeader
                                            image={<Avatar shape="square" size={48} color="brand" icon={<Sparkle24Regular />} />}
                                            header={
                                                <Body1Strong>
                                                    {t("app_sidebar.new_chat_recent_assistant_title", {
                                                        assistantName:
                                                            pageContext?.kind === "assistant"
                                                                ? (pageContext.assistantTitle ?? t("app_sidebar.new_chat_recent_assistant_fallback"))
                                                                : t("app_sidebar.new_chat_recent_assistant_fallback")
                                                    })}
                                                </Body1Strong>
                                            }
                                        />
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
                                        <CardHeader
                                            image={<Avatar shape="square" size={48} color="brand" icon={<Chat24Regular />} />}
                                            header={<Body1Strong>{t("app_sidebar.new_chat_default_primary")}</Body1Strong>}
                                        />
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
                                        <CardHeader
                                            image={<Avatar shape="square" size={48} color="brand" icon={<Chat24Regular />} />}
                                            header={<Body1Strong>{t("app_sidebar.new_chat_plain_title")}</Body1Strong>}
                                        />
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
                                        <CardHeader
                                            image={<Avatar shape="square" size={48} color="brand" icon={<Sparkle24Regular />} />}
                                            header={
                                                <Body1Strong>
                                                    {t("app_sidebar.new_chat_recent_assistant_title", { assistantName: recentAssistant.title })}
                                                </Body1Strong>
                                            }
                                        />
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
                                        <CardHeader
                                            image={<Avatar shape="square" size={48} color="brand" icon={<CompassNorthwest24Regular />} />}
                                            header={<Body1Strong>{t("app_sidebar.new_chat_discovery_card_title")}</Body1Strong>}
                                        />
                                    </Card>
                                )}
                            </div>
                            {(isCurrentAssistantChatRoute || recentAssistant) && (
                                <Button appearance="subtle" icon={<CompassNorthwest24Regular />} onClick={handleDiscoverAssistants}>
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
