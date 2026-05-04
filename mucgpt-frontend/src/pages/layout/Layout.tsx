import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button, DrawerBody, OverlayDrawer, FluentProvider, InlineDrawer, Spinner } from "@fluentui/react-components";
import { DismissRegular, Navigation24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Layout.module.css";
import logo from "../../assets/mucgpt_frost.png";
import alternative_logo from "../../assets/mugg_tschibidi.png";
import logo_black from "../../assets/mucgpt_frost.png";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { ApplicationConfig } from "../../api";
import { STORAGE_KEYS, createAppCssVars, createFluentTheme, createScaledTypographyTheme, getAppTokens } from "./LayoutHelper";
import { DEFAULTLLM, LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { LightContext } from "./LightContext";
import { DEFAULT_APP_CONFIG } from "../../constants";
import { UserContextProvider } from "./UserContextProvider";
import { LanguageSelector } from "../../components/LanguageSelector";
import { ThemeSelector } from "../../components/ThemeSelector";
import { FeedbackButton } from "../../components/FeedbackButton";
import { HelpButton } from "../../components/HelpButton";
import { configApi } from "../../api/core-client";
import { ApiError } from "../../api/fetch-utils";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import GlobalToastHandler from "../../components/GlobalToastHandler/GlobalToastHandler";
import TutorialsButton from "../../components/TutorialsButton";
import { ToolsProvider } from "../../components/ToolsProvider";
import Unauthorized from "../Unauthorized";
import { ConfigContext } from "../../context/ConfigContext";
import { AppSidebar } from "../../components/AppSidebar";
import { UnifiedHistoryProvider, UnifiedSidebarHistory } from "../../components/UnifiedHistory";

const APP_NAV_COLLAPSED_KEY = "APP_NAV_COLLAPSED";
const MOBILE_LAYOUT_BREAKPOINT = 640;

const formatDate = (date: Date) => {
    const formatted_date = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
    return formatted_date;
};

interface AppShellProps {
    config: ApplicationConfig;
    isLight: boolean;
    languagePreference: string;
    onLanguageSelectionChanged: (nextLanguage: string) => void;
    onThemeChange: (light: boolean) => void;
    onAcceptTermsOfUse: () => void;
    termsOfUseRead: boolean;
}

const AppShell = ({ config, isLight, languagePreference, onLanguageSelectionChanged, onThemeChange, onAcceptTermsOfUse, termsOfUseRead }: AppShellProps) => {
    const { t } = useTranslation();
    const location = useLocation();
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem(APP_NAV_COLLAPSED_KEY) === "true");

    useEffect(() => {
        const handleResize = () => {
            const nextIsMobile = window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
            setIsMobile(nextIsMobile);
            if (!nextIsMobile) {
                setMobileSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [location.pathname, location.search]);

    const toggleSidebarCollapsed = useCallback(() => {
        setIsSidebarCollapsed(previous => {
            const next = !previous;
            localStorage.setItem(APP_NAV_COLLAPSED_KEY, String(next));
            return next;
        });
    }, []);

    const secondaryTitle = t("components.history.history");
    const secondaryContent = !isMobile ? <UnifiedSidebarHistory /> : null;
    const mobileSecondaryContent = isMobile ? <UnifiedSidebarHistory requestClose={() => setMobileSidebarOpen(false)} /> : null;

    const utilitiesContent = (
        <div className={styles.mobileUtilities}>
            <div className={styles.mobileUtilityRow}>
                <ThemeSelector isLight={isLight} onThemeChange={onThemeChange} layout="row" label={t("common.theme")} />
            </div>
            <div className={styles.mobileUtilityRow}>
                <LanguageSelector defaultlang={languagePreference} onSelectionChange={onLanguageSelectionChanged} layout="row" label={t("common.language")} />
            </div>
            <div className={styles.mobileUtilityRow}>
                <TutorialsButton />
            </div>
            <div className={styles.mobileUtilityRow}>
                <HelpButton url={import.meta.env.BASE_URL + "#/faq"} label={t("components.helpbutton.help")} />
            </div>
            <div className={styles.mobileUtilityRow}>
                <FeedbackButton emailAddress="itm.kicc@muenchen.de" subject="MUCGPT" />
            </div>
        </div>
    );

    return (
        <>
            <div className={styles.layout}>
                <a href="#main-content" className={styles.skipLink}>
                    {t("common.skip_to_content", "Zum Hauptinhalt springen")}
                </a>

                <header className={styles.header} role="banner" aria-label={t("common.main_navigation", "Hauptnavigation")}>
                    <Link to="/" className={styles.headerTitleContainer} aria-label={t("common.home_link", "Zur Startseite")}>
                        <img src={config.alternative_logo ? alternative_logo : isLight ? logo : logo_black} alt="MUCGPT" className={styles.logo} />
                        <h1 className={styles.headerTitle} aria-label={t("common.environment_label", "Umgebung: {{env}}", { env: config.env_name })}>
                            {config.env_name}
                        </h1>
                    </Link>

                    {isMobile ? (
                        <Button
                            className={styles.mobileMenuButton}
                            icon={mobileSidebarOpen ? <DismissRegular className={styles.iconSize24} /> : <Navigation24Regular className={styles.iconSize24} />}
                            onClick={() => setMobileSidebarOpen(previous => !previous)}
                            aria-label={t("app_sidebar.toggle_navigation")}
                            aria-expanded={mobileSidebarOpen}
                            size="medium"
                        />
                    ) : (
                        <>
                            <nav className={styles.headerNavList} aria-label={t("common.user_settings", "Benutzereinstellungen")}>
                                <div className={styles.headerNavRightContainer}>
                                    <div className={styles.headerNavList}>
                                        <TutorialsButton />
                                    </div>
                                    <div className={styles.headerNavList}>
                                        <LanguageSelector defaultlang={languagePreference} onSelectionChange={onLanguageSelectionChanged} />
                                    </div>
                                    <div className={styles.headerNavList}>
                                        <ThemeSelector isLight={isLight} onThemeChange={onThemeChange} />
                                    </div>
                                    <div className={styles.headerNavList}>
                                        <HelpButton url={import.meta.env.BASE_URL + "#/faq"} label={t("components.helpbutton.help")} />
                                    </div>
                                    <div className={styles.headerNavList}>
                                        <FeedbackButton emailAddress="itm.kicc@muenchen.de" subject="MUCGPT" />
                                    </div>
                                </div>
                            </nav>
                        </>
                    )}
                </header>

                <div
                    className={`${styles.shellBody} ${!isMobile && isSidebarCollapsed ? styles.shellBodyCollapsed : ""} ${
                        isMobile ? styles.shellBodyMobile : ""
                    }`}
                >
                    {!isMobile && (
                        <aside className={styles.sidebarColumn}>
                            <InlineDrawer open position="start" separator className={styles.desktopSidebarDrawer}>
                                <AppSidebar
                                    collapsed={isSidebarCollapsed}
                                    isMobile={false}
                                    onToggleCollapsed={toggleSidebarCollapsed}
                                    secondaryContent={secondaryContent}
                                    secondaryTitle={secondaryTitle}
                                />
                            </InlineDrawer>
                        </aside>
                    )}

                    <main id="main-content" role="main" aria-label={t("common.main_content", "Hauptinhalt")} className={styles.mainContent}>
                        <Outlet />
                    </main>
                </div>
            </div>

            {isMobile && (
                <OverlayDrawer
                    open={mobileSidebarOpen}
                    onOpenChange={(_event, data) => setMobileSidebarOpen(data.open)}
                    position="start"
                    className={styles.mobileSidebarSurface}
                >
                    <DrawerBody className={styles.mobileSidebarBody}>
                        <AppSidebar
                            collapsed={false}
                            isMobile={true}
                            onToggleCollapsed={() => setMobileSidebarOpen(false)}
                            onNavigate={() => setMobileSidebarOpen(false)}
                            secondaryContent={mobileSecondaryContent}
                            secondaryTitle={secondaryTitle}
                            utilitiesContent={utilitiesContent}
                        />
                    </DrawerBody>
                </OverlayDrawer>
            )}

            <TermsOfUseDialog defaultOpen={!termsOfUseRead} onAccept={onAcceptTermsOfUse} showTrigger={false} />
        </>
    );
};

export const Layout = () => {
    const navigate = useNavigate();

    const { setLanguage } = useContext(LanguageContext);
    const { setLLM, setAvailableLLMs } = useContext(LLMContext);
    const { showError } = useGlobalToastContext();

    const configApiCalledRef = useRef(false);

    const { t, i18n } = useTranslation();

    const [config, setConfig] = useState<ApplicationConfig>(DEFAULT_APP_CONFIG);
    const [, setModels] = useState(config.models);
    const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
    const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
    const [unauthorizedRedirectUrl, setUnauthorizedRedirectUrl] = useState<string | undefined>(undefined);

    const termsOfUseRead = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const [languagePreference, setLanguagePreference] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE) || DEFAULTLANG);
    const [llmPreference] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM) || config.models?.[0]?.llm_name || DEFAULTLLM);

    const fontScalingPreference = Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_FONT_SCALING)) || 1;
    const [fontscaling] = useState<number>(fontScalingPreference);

    const lightThemePreference =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === "true";
    const [isLight, setLight] = useState<boolean>(lightThemePreference);

    const appTokens = useMemo(() => getAppTokens(isLight), [isLight]);
    const theme = useMemo(() => createScaledTypographyTheme(createFluentTheme(appTokens, isLight), fontscaling), [appTokens, isLight, fontscaling]);
    const appCssVars = useMemo(() => createAppCssVars(appTokens), [appTokens]);

    useEffect(() => {
        const root = document.documentElement;
        for (const [key, value] of Object.entries(appCssVars)) {
            root.style.setProperty(key, value);
        }
    }, [appCssVars]);

    const onThemeChange = useCallback(
        (light: boolean) => {
            setLight(light);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
        },
        [setLight]
    );

    useEffect(() => {
        if (configApiCalledRef.current) return;
        configApiCalledRef.current = true;

        configApi()
            .then(result => {
                const models = result.models ?? [];
                setConfig({ ...DEFAULT_APP_CONFIG, ...result, models });
                setModels(models);
                if (models.length === 0) {
                    console.error("Keine Modelle vorhanden");
                }
                setAvailableLLMs(models);
                const preferredModel = models.find(model => model.llm_name === llmPreference) || models[0];
                if (preferredModel) {
                    setLLM(preferredModel);
                }
                setIsLoadingConfig(false);
            })
            .catch(error => {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                    setIsUnauthorized(true);
                    setUnauthorizedRedirectUrl(error.redirectUrl);
                    setIsLoadingConfig(false);
                    return;
                }
                console.error(t("common.errors.config_not_loaded"), error);
                const errorMessage = error instanceof Error ? error.message : t("common.errors.failed_to_load_config");
                showError(t("common.errors.configuration_error"), errorMessage);
                setIsLoadingConfig(false);
            });
        i18n.changeLanguage(languagePreference);
    }, [i18n, languagePreference, llmPreference, setAvailableLLMs, setLLM, showError, t]);

    const onAcceptTermsOfUse = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.frontend_version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.frontend_version);
            navigate("version");
        }
    }, [config.frontend_version, navigate]);

    const onLanguageSelectionChanged = useCallback(
        (nextLanguage: string) => {
            const lang = nextLanguage || DEFAULTLANG;
            i18n.changeLanguage(lang);
            setLanguage(lang);
            setLanguagePreference(lang);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_LANGUAGE, lang);
        },
        [i18n, setLanguage]
    );

    return (
        <FluentProvider theme={theme}>
            <LightContext.Provider value={isLight}>
                <UserContextProvider>
                    {isLoadingConfig ? (
                        <div className={styles.loadingContainer}>
                            <Spinner size="large" label={t("common.loading", "Lade Konfiguration...")} />
                        </div>
                    ) : isUnauthorized ? (
                        <Unauthorized redirectUrl={unauthorizedRedirectUrl} />
                    ) : (
                        <ConfigContext.Provider value={config}>
                            <ToolsProvider>
                                <UnifiedHistoryProvider>
                                    <AppShell
                                        config={config}
                                        isLight={isLight}
                                        languagePreference={languagePreference}
                                        onLanguageSelectionChanged={onLanguageSelectionChanged}
                                        onThemeChange={onThemeChange}
                                        onAcceptTermsOfUse={onAcceptTermsOfUse}
                                        termsOfUseRead={termsOfUseRead}
                                    />
                                </UnifiedHistoryProvider>
                            </ToolsProvider>
                        </ConfigContext.Provider>
                    )}
                    <GlobalToastHandler />
                </UserContextProvider>
            </LightContext.Provider>
        </FluentProvider>
    );
};

export default Layout;
