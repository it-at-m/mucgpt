import { Outlet, Link, useNavigate } from "react-router-dom";
import styles from "./Layout.module.css";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import logo from "../../assets/mucgpt_frost.png";
import alternative_logo from "../../assets/mugg_tschibidi.png";
import logo_black from "../../assets/mucgpt_frost.png";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from "react-i18next";
import { ApplicationConfig } from "../../api";
import { FluentProvider, Button, Accordion, AccordionHeader, AccordionItem, AccordionPanel, Spinner } from "@fluentui/react-components";
import { STORAGE_KEYS, createAppCssVars, createFluentTheme, createScaledTypographyTheme, getAppTokens } from "./LayoutHelper";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { LightContext } from "./LightContext";
import { DEFAULT_APP_CONFIG } from "../../constants";
import { HeaderContext } from "./HeaderContextProvider";
import { UserContextProvider } from "./UserContextProvider";
import { LanguageSelector } from "../../components/LanguageSelector";
import { ThemeSelector } from "../../components/ThemeSelector";
import { FeedbackButton } from "../../components/FeedbackButton";
import { HelpButton } from "../../components/HelpButton";
import { configApi } from "../../api/core-client";
import { ApiError } from "../../api/fetch-utils";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import GlobalToastHandler from "../../components/GlobalToastHandler/GlobalToastHandler";
import { Navigation24Regular, DismissRegular, Settings24Regular, ContactCard24Regular } from "@fluentui/react-icons";
import TutorialsButton from "../../components/TutorialsButton";
import { ToolsProvider } from "../../components/ToolsProvider";
import Unauthorized from "../Unauthorized";
import { ConfigContext } from "../../context/ConfigContext";
import { AssistantStorageService } from "../../service/assistantstorage";
import { ASSISTANT_STORE } from "../../constants";

const formatDate = (date: Date) => {
    const formatted_date = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
    return formatted_date;
};

export const Layout = () => {
    // navigate
    const navigate = useNavigate();

    // Contexts
    const { setLanguage } = useContext(LanguageContext);
    const { setLLM, setAvailableLLMs } = useContext(LLMContext);
    const { header } = useContext(HeaderContext);
    const { showError } = useGlobalToastContext();

    // Use useRef to prevent duplicate API calls
    const configApiCalledRef = useRef(false);

    // Translation
    const { t, i18n } = useTranslation();

    const [config, setConfig] = useState<ApplicationConfig>(DEFAULT_APP_CONFIG);

    const [, setModels] = useState(config.models);
    const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
    const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
    const [unauthorizedRedirectUrl, setUnauthorizedRedirectUrl] = useState<string | undefined>(undefined);

    // Mobile menu state
    const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
    const toggleMobileMenu = useCallback(() => setMobileMenuOpen(prev => !prev), []);

    // vars from storage
    const termsofuseread = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const language_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE) || DEFAULTLANG;
    const llm_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM) || config.models[0].llm_name;

    const font_scaling_pref = Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_FONT_SCALING)) || 1;
    const [fontscaling] = useState<number>(font_scaling_pref);

    const ligth_theme_pref =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == "true";
    const [isLight, setLight] = useState<boolean>(ligth_theme_pref);

    const appTokens = useMemo(() => getAppTokens(isLight), [isLight]);
    const theme = useMemo(() => createScaledTypographyTheme(createFluentTheme(appTokens, isLight), fontscaling), [appTokens, isLight, fontscaling]);
    const appCssVars = useMemo(() => createAppCssVars(appTokens) as CSSProperties, [appTokens]);

    // Apply custom CSS vars globally on :root so they're available in Fluent UI portals (toasts, dialogs etc.)
    // which render outside the FluentProvider wrapper in the DOM.
    useEffect(() => {
        const root = document.documentElement;
        for (const [key, value] of Object.entries(appCssVars)) {
            root.style.setProperty(key, value as string);
        }
    }, [appCssVars]);

    // change theme
    const onThemeChange = useCallback(
        (light: boolean) => {
            setLight(light);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
        },
        [setLight]
    );

    useEffect(() => {
        // Skip if the API has already been called
        if (configApiCalledRef.current) return;
        configApiCalledRef.current = true;

        configApi()
            .then(result => {
                setConfig({ ...DEFAULT_APP_CONFIG, ...result });
                setModels(result.models);
                if (result.models.length === 0) {
                    console.error("Keine Modelle vorhanden");
                }
                setAvailableLLMs(result.models);
                setLLM(result.models.find(model => model.llm_name == llm_pref) || result.models[0]);
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
        i18n.changeLanguage(language_pref);
    }, [showError]);

    // terms of use
    const onAcceptTermsOfUse = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.frontend_version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.frontend_version);
            navigate("version");
        }
    }, [config.frontend_version, navigate]);

    // add legacy assistants
    const onAddLegacyAssistants = useCallback(async () => {
        const storageService = new AssistantStorageService(ASSISTANT_STORE);
        for (let i = 1; i <= 3; i++) {
            await storageService.createAssistantConfig(
                {
                    title: `Legacy Assistant ${i}`,
                    description: `This is a test legacy assistant with ID ${i}`,
                    publish: false,
                    system_message: "You are a legacy assistant.",
                    creativity: "medium",
                    quick_prompts: [],
                    examples: [],
                    version: "0",
                    is_visible: true
                },
                String(i)
            );
        }
        alert("Added legacy assistants 1, 2, and 3. You can find them in your owned assistants.");
    }, []);

    // language change
    const onLanguageSelectionChanged = useCallback(
        (nextLanguage: string) => {
            const lang = nextLanguage || DEFAULTLANG;
            i18n.changeLanguage(lang);
            setLanguage(lang);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_LANGUAGE, lang);
        },
        [setLanguage, i18n]
    );

    // Check window size for mobile view
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <FluentProvider theme={theme} style={appCssVars}>
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
                                <div className={styles.layout}>
                                    {/* Skip to main content for screen readers */}
                                    <a href="#main-content" className={styles.skipLink}>
                                        {t("common.skip_to_content", "Zum Hauptinhalt springen")}
                                    </a>

                                    <header className={styles.header} role="banner" aria-label={t("common.main_navigation", "Hauptnavigation")}>
                                        <Link to="/" className={styles.headerTitleContainer} aria-label={t("common.home_link", "Zur Startseite")}>
                                            <img
                                                src={config.alternative_logo ? alternative_logo : isLight ? logo : logo_black}
                                                alt="MUCGPT"
                                                className={styles.logo}
                                            />
                                            <h1
                                                className={styles.headerTitle}
                                                aria-label={t("common.environment_label", "Umgebung: {{env}}", { env: config.env_name })}
                                            >
                                                {config.env_name}
                                            </h1>
                                        </Link>

                                        {isMobile ? (
                                            <Button
                                                className={styles.mobileMenuButton}
                                                icon={
                                                    mobileMenuOpen ? (
                                                        <DismissRegular className={styles.iconSize24} />
                                                    ) : (
                                                        <Navigation24Regular className={styles.iconSize24} />
                                                    )
                                                }
                                                onClick={toggleMobileMenu}
                                                aria-label={mobileMenuOpen ? t("common.close_menu", "Menü schließen") : t("common.open_menu", "Menü öffnen")}
                                                aria-expanded={mobileMenuOpen}
                                                size="medium"
                                            />
                                        ) : (
                                            <>
                                                <nav className={styles.headerNavList} aria-label={t("common.page_navigation", "Seitennavigation")}>
                                                    <div className={styles.headerNavPageLink}>{header}</div>
                                                </nav>
                                                <nav className={styles.headerNavList} aria-label={t("common.user_settings", "Benutzereinstellungen")}>
                                                    <div className={styles.headerNavRightContainer}>
                                                        <div className={styles.headerNavList}>
                                                            <TutorialsButton />
                                                        </div>
                                                        <div className={styles.headerNavList}>
                                                            <LanguageSelector defaultlang={language_pref} onSelectionChange={onLanguageSelectionChanged} />
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
                                                        <div className={styles.headerNavList}>
                                                            <Button size="small" appearance="outline" onClick={onAddLegacyAssistants}>
                                                                Test Legacy
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </nav>
                                            </>
                                        )}

                                        {isMobile && mobileMenuOpen && (
                                            <div className={styles.mobileMenu}>
                                                <div className={styles.mobileMenuHeader}>
                                                    <div className={styles.headerNavPageLink}>{header}</div>
                                                </div>
                                                <div className={styles.mobileMenuAccordion}>
                                                    <Accordion collapsible>
                                                        <AccordionItem value="settings">
                                                            <AccordionHeader icon={<Settings24Regular />}>
                                                                {t("common.settings", "Einstellungen")}
                                                            </AccordionHeader>
                                                            <AccordionPanel className={styles.accordionPanel}>
                                                                <div className={styles.accordionContent}>
                                                                    <div className={styles.accordionItem}>
                                                                        <span>{t("common.theme", "Farbschema")}:</span>
                                                                        <ThemeSelector isLight={isLight} onThemeChange={onThemeChange} />
                                                                    </div>
                                                                    <div className={styles.accordionItem}>
                                                                        <span>{t("common.language", "Sprache")}:</span>
                                                                        <LanguageSelector
                                                                            defaultlang={language_pref}
                                                                            onSelectionChange={onLanguageSelectionChanged}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </AccordionPanel>
                                                        </AccordionItem>
                                                        <AccordionItem value="help">
                                                            <AccordionHeader icon={<ContactCard24Regular />}>
                                                                {t("common.support", "Support & Hilfe")}
                                                            </AccordionHeader>
                                                            <AccordionPanel className={styles.accordionPanel}>
                                                                <div className={styles.accordionContent}>
                                                                    <div className={styles.accordionItem}>
                                                                        <TutorialsButton />
                                                                    </div>
                                                                    <div className={styles.accordionItem}>
                                                                        <HelpButton
                                                                            url={import.meta.env.BASE_URL + "#/faq"}
                                                                            label={t("components.helpbutton.help")}
                                                                        />
                                                                    </div>
                                                                    <div className={styles.accordionItem}>
                                                                        <FeedbackButton emailAddress="itm.kicc@muenchen.de" subject="MUCGPT" />
                                                                    </div>
                                                                </div>
                                                            </AccordionPanel>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                            </div>
                                        )}
                                    </header>
                                    <main
                                        id="main-content"
                                        role="main"
                                        aria-label={t("common.main_content", "Hauptinhalt")}
                                        className={
                                            isMobile && mobileMenuOpen
                                                ? styles.mobileMainContentWithMenu
                                                : isMobile
                                                  ? styles.mobileMainContent
                                                  : styles.mainContent
                                        }
                                    >
                                        <Outlet />
                                    </main>
                                </div>
                                <TermsOfUseDialog defaultOpen={!termsofuseread} onAccept={onAcceptTermsOfUse} showTrigger={false} />
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
