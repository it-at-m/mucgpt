import { Outlet, Link, useNavigate } from "react-router-dom";
import styles from "./Layout.module.css";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import logo from "../../assets/mucgpt_logo.png";
import alternative_logo from "../../assets/mugg_tschibidi.png";
import logo_black from "../../assets/mucgpt_black.png";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from "react-i18next";
import { ApplicationConfig } from "../../api";
import { FluentProvider, Theme, Button, Accordion, AccordionHeader, AccordionItem, AccordionPanel } from "@fluentui/react-components";
import { useStyles, STORAGE_KEYS, adjustTheme } from "./LayoutHelper";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { LightContext } from "./LightContext";
import { DEFAULT_APP_CONFIG } from "../../constants";
import { HeaderContext } from "./HeaderContextProvider";
import { UserContextProvider } from "./UserContextProvider";
import { LanguageSelector } from "../../components/LanguageSelector";
import { ThemeSelector } from "../../components/ThemeSelector";
import { FeedbackButton } from "../../components/FeedbackButton";
import { VersionInfo } from "../../components/VersionInfo";
import { HelpButton } from "../../components/HelpButton";
import { configApi } from "../../api/core-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { Navigation24Regular, DismissRegular, Settings24Regular, ContactCard24Regular } from "@fluentui/react-icons";

const formatDate = (date: Date) => {
    const formatted_date = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
    return formatted_date;
};

export const Layout = () => {
    //style
    const styles2 = useStyles();

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

    // Mobile menu state
    const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
    const toggleMobileMenu = useCallback(() => setMobileMenuOpen(prev => !prev), []);

    // vars from storage
    const termsofuseread = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const language_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE) || DEFAULTLANG;
    const llm_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM) || config.models[0].llm_name;

    const ligth_theme_pref =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == "true";
    const [isLight, setLight] = useState<boolean>(ligth_theme_pref);

    const [theme, setTheme] = useState<Theme>(adjustTheme(isLight));

    // change theme
    const onThemeChange = useCallback(
        (light: boolean) => {
            setLight(light);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
            setTheme(adjustTheme(light));
        },
        [setLight, setTheme]
    );

    useEffect(() => {
        // Skip if the API has already been called
        if (configApiCalledRef.current) return;
        configApiCalledRef.current = true;

        configApi()
            .then(result => {
                setConfig(result);
                setModels(result.models);
                if (result.models.length === 0) {
                    console.error("Keine Modelle vorhanden");
                }
                setAvailableLLMs(result.models);
                setLLM(result.models.find(model => model.llm_name == llm_pref) || result.models[0]);
            })
            .catch(error => {
                console.error(t("common.errors.config_not_loaded"), error);
                const errorMessage = error instanceof Error ? error.message : t("common.errors.failed_to_load_config");
                showError(t("common.errors.configuration_error"), errorMessage);
            });
        i18n.changeLanguage(language_pref);
    }, [showError]);

    // terms of use
    const onAcceptTermsOfUse = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.version);
            navigate("version");
        }
    }, [config.version, navigate]);

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
        <FluentProvider theme={theme}>
            <LightContext.Provider value={isLight}>
                <UserContextProvider>
                    <div className={styles.layout}>
                        {/* Skip to main content for screen readers */}
                        <a href="#main-content" className={styles.skipLink}>
                            {t("common.skip_to_content", "Zum Hauptinhalt springen")}
                        </a>

                        <header className={styles2.header} role="banner" aria-label={t("common.main_navigation", "Hauptnavigation")}>
                            <div className={styles.header}>
                                <Link to="/" className={styles.headerTitleContainer} aria-label={t("common.home_link", "Zur Startseite")}>
                                    <img src={config.alternative_logo ? alternative_logo : isLight ? logo_black : logo} alt="MUCGPT" className={styles.logo} />
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
                                            </div>
                                        </nav>
                                    </>
                                )}
                            </div>

                            {isMobile && mobileMenuOpen && (
                                <div className={styles.mobileMenu}>
                                    <div className={styles.mobileMenuHeader}>
                                        <div className={styles.headerNavPageLink}>{header}</div>
                                    </div>
                                    <div className={styles.mobileMenuAccordion}>
                                        <Accordion collapsible>
                                            <AccordionItem value="settings">
                                                <AccordionHeader icon={<Settings24Regular />}>{t("common.settings", "Einstellungen")}</AccordionHeader>
                                                <AccordionPanel className={styles.accordionPanel}>
                                                    <div className={styles.accordionContent}>
                                                        <div className={styles.accordionItem}>
                                                            <span>{t("common.theme", "Farbschema")}:</span>
                                                            <ThemeSelector isLight={isLight} onThemeChange={onThemeChange} />
                                                        </div>
                                                        <div className={styles.accordionItem}>
                                                            <span>{t("common.language", "Sprache")}:</span>
                                                            <LanguageSelector defaultlang={language_pref} onSelectionChange={onLanguageSelectionChanged} />
                                                        </div>
                                                    </div>
                                                </AccordionPanel>
                                            </AccordionItem>
                                            <AccordionItem value="help">
                                                <AccordionHeader icon={<ContactCard24Regular />}>{t("common.support", "Support & Hilfe")}</AccordionHeader>
                                                <AccordionPanel className={styles.accordionPanel}>
                                                    <div className={styles.accordionContent}>
                                                        <div className={styles.accordionItem}>
                                                            <HelpButton url={import.meta.env.BASE_URL + "#/faq"} label={t("components.helpbutton.help")} />
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
                            className={isMobile && mobileMenuOpen ? styles.mobileMainContentWithMenu : isMobile ? styles.mobileMainContent : styles.mainContent}
                        >
                            <Outlet />
                        </main>

                        <footer className={styles.footer} role="contentinfo" aria-label={t("common.footer_info", "Fußzeileninformationen")}>
                            <div className={`${styles.footerSection} ${styles.footerCompanyInfo}`}>
                                <address>
                                    Landeshauptstadt München <br />
                                    RIT/it@M KICC
                                </address>
                            </div>
                            <div className={styles.footerSection}>
                                <VersionInfo version={config.version} commit={config.commit} versionUrl={import.meta.env.BASE_URL + "#/version"} />
                            </div>
                            <TermsOfUseDialog defaultOpen={!termsofuseread} onAccept={onAcceptTermsOfUse} />
                        </footer>
                    </div>
                </UserContextProvider>
            </LightContext.Provider>
        </FluentProvider>
    );
};

export default Layout;
