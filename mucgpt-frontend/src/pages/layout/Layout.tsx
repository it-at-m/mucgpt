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
import { FluentProvider, Theme } from "@fluentui/react-components";
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

    const [, setSimply] = useState<boolean>(true);
    const [, setModels] = useState(config.models);

    // vars from storage
    const termsofuseread = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const language_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE) || DEFAULTLANG;
    const llm_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM) || config.models[0].llm_name;

    const font_scaling_pref = Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_FONT_SCALING)) || 1;
    const [fontscaling] = useState<number>(font_scaling_pref);

    const ligth_theme_pref =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == "true";
    const [isLight, setLight] = useState<boolean>(ligth_theme_pref);

    const [theme, setTheme] = useState<Theme>(adjustTheme(isLight, fontscaling));

    // change theme
    const onThemeChange = useCallback(
        (light: boolean) => {
            setLight(light);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
            setTheme(adjustTheme(light, fontscaling));
        },
        [fontscaling, setLight, setTheme]
    );

    useEffect(() => {
        // Skip if the API has already been called
        if (configApiCalledRef.current) return;
        configApiCalledRef.current = true;

        configApi()
            .then(result => {
                setConfig(result);
                setModels(result.models);
                setSimply(result.frontend.enable_simply);
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
                                    <img
                                        src={config.frontend.alternative_logo ? alternative_logo : isLight ? logo_black : logo}
                                        alt="MUCGPT"
                                        className={styles.logo}
                                    />
                                    <h1
                                        className={styles.headerTitle}
                                        aria-label={t("common.environment_label", "Umgebung: {{env}}", { env: config.frontend.labels.env_name })}
                                    >
                                        {config.frontend.labels.env_name}
                                    </h1>
                                </Link>
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
                            </div>
                        </header>

                        <main id="main-content" role="main" aria-label={t("common.main_content", "Hauptinhalt")}>
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
