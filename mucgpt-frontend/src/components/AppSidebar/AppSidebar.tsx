import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
import { Bot24Regular, ChatAdd24Regular, ChevronDown24Regular, ChevronLeft24Regular, ChevronRight24Regular, Home24Regular } from "@fluentui/react-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./AppSidebar.module.css";

interface AppSidebarProps {
    collapsed: boolean;
    isMobile: boolean;
    onToggleCollapsed?: () => void;
    onNavigate?: () => void;
    secondaryContent?: ReactNode | null;
    secondaryTitle?: string | null;
    utilitiesContent?: ReactNode | null;
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

const isAssistantRoute = (pathname: string) =>
    pathname === "/discovery" ||
    pathname.startsWith("/assistant/") ||
    pathname.startsWith("/communityassistant/") ||
    pathname.startsWith("/owned/communityassistant/") ||
    pathname.startsWith("/deleted/communityassistant/");

export const AppSidebar = ({
    collapsed,
    isMobile,
    onToggleCollapsed,
    onNavigate,
    secondaryContent = null,
    secondaryTitle = null,
    utilitiesContent = null
}: AppSidebarProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(true);

    const navigationItems = useMemo<NavigationItem[]>(
        () => [
            {
                id: "home",
                kind: "link",
                label: t("app_sidebar.home"),
                ariaLabel: t("app_sidebar.go_home"),
                to: "/",
                icon: <Home24Regular className={styles.navIcon} />,
                isActive: location.pathname === "/"
            },
            {
                id: "assistants",
                kind: "link",
                label: t("app_sidebar.assistants"),
                ariaLabel: t("app_sidebar.go_assistants"),
                to: "/discovery",
                icon: <Bot24Regular className={styles.navIcon} />,
                isActive: isAssistantRoute(location.pathname)
            },
            {
                id: "new-chat",
                kind: "action",
                label: t("app_sidebar.new_chat"),
                ariaLabel: t("app_sidebar.start_new_chat"),
                to: "/chat?new=1",
                icon: <ChatAdd24Regular className={styles.navIcon} />,
                isActive: false
            }
        ],
        [location.pathname, t]
    );

    const handleNavigate = (to: string) => {
        const target = to === "/chat?new=1" ? `/chat?new=${Date.now()}` : to;
        navigate(target);
        onNavigate?.();
    };

    const desktopToggleEnabled = !isMobile && !!onToggleCollapsed;
    const toggleLabel = t("app_sidebar.toggle_navigation");
    const resizeLabel = t("app_sidebar.resize_navigation");
    const toggleInteractiveClassName = desktopToggleEnabled ? styles.resizeCursor : "";
    const collapseButtonClassName = `${styles.collapseButton} ${toggleInteractiveClassName}`;

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
                                        onClick={() => item.to && handleNavigate(item.to)}
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
                                <Accordion collapsible defaultOpenItems={["secondary"]} className={styles.secondaryAccordion}>
                                    <AccordionItem value="secondary">
                                        <AccordionHeader>{secondaryTitle}</AccordionHeader>
                                        <AccordionPanel className={styles.secondaryPanel}>
                                            <div className={styles.secondaryPanelContent}>{secondaryContent}</div>
                                        </AccordionPanel>
                                    </AccordionItem>
                                </Accordion>
                            </section>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {utilitiesContent && isMobile && (
                        <div className={styles.footerSection}>
                            <div className={styles.sectionDivider} aria-hidden="true" />
                            <section className={styles.utilitiesSection} aria-label={t("app_sidebar.preferences_and_help")}>
                                <div
                                    id="sidebar-utilities-panel"
                                    className={`${styles.utilitiesContent} ${!isUtilitiesOpen ? styles.utilitiesContentHidden : ""}`}
                                >
                                    {utilitiesContent}
                                </div>
                                <Button
                                    appearance="subtle"
                                    className={styles.utilitiesToggle}
                                    aria-controls="sidebar-utilities-panel"
                                    aria-expanded={isUtilitiesOpen}
                                    onClick={() => setIsUtilitiesOpen(open => !open)}
                                >
                                    <span>{t("app_sidebar.preferences_and_help")}</span>
                                    <ChevronDown24Regular
                                        className={`${styles.utilitiesToggleIcon} ${isUtilitiesOpen ? styles.utilitiesToggleIconOpen : ""}`}
                                    />
                                </Button>
                            </section>
                        </div>
                    )}

                    {onToggleCollapsed && (
                        <div className={styles.footerSection}>
                            <div className={styles.sectionDivider} aria-hidden="true" />
                            {isMobile ? (
                                <Button
                                    appearance="subtle"
                                    size="large"
                                    className={collapseButtonClassName}
                                    icon={collapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
                                    aria-label={toggleLabel}
                                    onClick={onToggleCollapsed}
                                />
                            ) : (
                                <Tooltip content={toggleLabel} relationship="description" positioning="above">
                                    <Button
                                        appearance="subtle"
                                        size="large"
                                        className={collapseButtonClassName}
                                        icon={collapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
                                        aria-label={toggleLabel}
                                        onClick={onToggleCollapsed}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
