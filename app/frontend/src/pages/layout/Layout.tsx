import { Outlet, NavLink, Link, useNavigate, useParams } from "react-router-dom";
import styles from "./Layout.module.css";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import logo from "../../assets/mucgpt_logo.png";
import alternative_logo from "../../assets/mugg_tschibidi.png";
import logo_black from "../../assets/mucgpt_black.png";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from "react-i18next";
import { ApplicationConfig, configApi } from "../../api";
import { SettingsDrawer } from "../../components/SettingsDrawer";
import { FluentProvider, Theme } from "@fluentui/react-components";
import { useStyles, STORAGE_KEYS, adjustTheme } from "./LayoutHelper";
import { DEFAULTLLM, LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { LightContext } from "./LightContext";
import { BOT_STORE, CHAT_STORE, DEFAULT_APP_CONFIG } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { StorageService } from "../../service/storage";

const formatDate = (date: Date) => {
    let formatted_date = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
    return formatted_date;
};

export const Layout = () => {
    // params
    const { id } = useParams();

    //style
    const styles2 = useStyles();

    // navigate
    const navigate = useNavigate();

    // Contexts
    const { language, setLanguage } = useContext(LanguageContext);
    const { LLM, setLLM } = useContext(LLMContext);

    // Use useRef to prevent duplicate API calls
    const configApiCalledRef = useRef(false);

    // Translation
    const { t, i18n } = useTranslation();

    const [config, setConfig] = useState<ApplicationConfig>(DEFAULT_APP_CONFIG);

    const [simply, setSimply] = useState<boolean>(true);
    const [models, setModels] = useState(config.models);

    const [title, setTitle] = useState<[string, string]>(["0", ""]);

    // vars from storage
    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const termsofuseread = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const language_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE) || DEFAULTLANG;
    const llm_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM) || config.models[0].llm_name;

    const font_scaling_pref = Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_FONT_SCALING)) || 1;
    const [fontscaling, setFontscaling] = useState<number>(font_scaling_pref);

    const ligth_theme_pref =
        localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == "true";
    const [isLight, setLight] = useState<boolean>(ligth_theme_pref);

    const [theme, setTheme] = useState<Theme>(adjustTheme(isLight, fontscaling));

    // scale font size
    const onFontscaleChange = useCallback((fontscale: number) => {
        setFontscaling(fontscale);
        setTheme(adjustTheme(isLight, fontscale));
        localStorage.setItem(STORAGE_KEYS.SETTINGS_FONT_SCALING, fontscale.toString());
    }, [isLight, setFontscaling, setTheme]);

    // change theme
    const onThemeChange = useCallback((light: boolean) => {
        setLight(light);
        localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
        setTheme(adjustTheme(light, fontscaling));
    }, [fontscaling, setLight, setTheme]);

    //do migrations for chat
    useEffect(() => {
        new StorageService<any, any>(CHAT_STORE).connectToDB();
        if (id) {
            botStorageService.getBotConfig(id).then(bot => {
                if (bot) setTitle([bot.id as string, bot.title]);
            });
        }
    }, [id]);

    useEffect(() => {
        // Skip if the API has already been called
        if (configApiCalledRef.current) return;
        configApiCalledRef.current = true;

        configApi().then(
            result => {
                setConfig(result);
                setModels(result.models);
                setSimply(result.frontend.enable_simply);
                if (result.models.length === 0) {
                    console.error("Keine Modelle vorhanden");
                }
                setLLM(result.models.find(model => model.llm_name == llm_pref) || result.models[0]);
                for (let bot of result.frontend.community_assistants) {
                    bot.system_message = bot.system_message.replace(/\\n/g, "\n");
                    if (bot.system_message.startsWith('"') && bot.system_message.endsWith('"')) {
                        bot.system_message = bot.system_message.slice(1, -1);
                    }
                    bot.description = bot.description.replace(/\\n/g, "\n").replace(/  /g, "  \n");
                    if (bot.description.startsWith('"') && bot.description.endsWith('"')) {
                        bot.description = bot.description.slice(1, -1);
                    }
                    botStorageService.createBotConfig(bot, bot.id);
                }
            },
            () => {
                console.error("Config nicht geladen");
            }
        );
        i18n.changeLanguage(language_pref);
    }, []);

    // terms of use
    const onAcceptTermsOfUse = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.version);
            navigate("version");
        }
    }, [config.version, navigate]);

    // language change
    const onLanguageSelectionChanged = useCallback((e: SelectionEvents, selection: OptionOnSelectData) => {
        let lang = selection.optionValue || DEFAULTLANG;
        i18n.changeLanguage(lang);
        setLanguage(lang);
        localStorage.setItem(STORAGE_KEYS.SETTINGS_LANGUAGE, lang);
    }, [setLanguage, i18n]);

    // llm change
    const onLLMSelectionChanged = useCallback((e: SelectionEvents, selection: OptionOnSelectData) => {
        let llm = selection.optionValue || DEFAULTLLM;
        let found_llm = models.find(model => model.llm_name == llm);
        if (found_llm) {
            setLLM(found_llm);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, llm);
        }
    }, [models, setLLM]);

    return (
        <FluentProvider theme={theme}>
            <LightContext.Provider value={isLight}>
                <div className={styles.layout}>
                    <header className={styles2.header} role={"banner"}>
                        <div className={styles.header}>
                            <Link to="/" className={styles.headerTitleContainer}>
                                <img
                                    src={config.frontend.alternative_logo ? alternative_logo : isLight ? logo : logo_black}
                                    alt="MUCGPT logo"
                                    aria-label="MUCGPT Logo"
                                    className={styles.logo}
                                ></img>
                                <h3 className={styles.headerTitle} aria-description="Umgebung:">
                                    {config.frontend.labels.env_name}
                                </h3>
                            </Link>
                            <div className={styles.headerNavList}>
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        MUCGPT
                                    </NavLink>
                                </div>
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/chat" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        {t("header.chat")}
                                    </NavLink>
                                </div>
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink
                                        to="/sum"
                                        state={{ from: "This is my props" }}
                                        className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                                    >
                                        {t("header.sum")}
                                    </NavLink>
                                </div>
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink
                                        to="/brainstorm"
                                        className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                                    >
                                        {t("header.brainstorm")}
                                    </NavLink>
                                </div>
                                {simply && (
                                    <div className={styles.headerNavLeftMargin}>
                                        <NavLink
                                            to="/simply"
                                            className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                                        >
                                            {t("header.simply")}
                                        </NavLink>
                                    </div>
                                )}
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink
                                        to={"/bot/" + title[0]}
                                        className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}
                                    >
                                        {title[1]}
                                    </NavLink>
                                </div>
                            </div>
                            <div className={styles.SettingsDrawer}>
                                <SettingsDrawer
                                    defaultlang={language_pref}
                                    onLanguageSelectionChanged={onLanguageSelectionChanged}
                                    version={config.version}
                                    commit={config.commit}
                                    fontscale={fontscaling}
                                    setFontscale={onFontscaleChange}
                                    isLight={isLight}
                                    setTheme={onThemeChange}
                                    defaultLLM={llm_pref}
                                    onLLMSelectionChanged={onLLMSelectionChanged}
                                    llmOptions={models}
                                    currentLLM={LLM}
                                />
                            </div>
                        </div>
                    </header>
                    <Outlet />

                    <footer className={styles.footer} role={"banner"}>
                        <div>
                            Landeshauptstadt München <br />
                            RIT/it@M KICC <br />
                        </div>
                        <div className={styles.headerNavRightMargin}>
                            <TermsOfUseDialog defaultOpen={!termsofuseread} onAccept={onAcceptTermsOfUse}></TermsOfUseDialog>
                        </div>
                    </footer>
                </div>
            </LightContext.Provider>
        </FluentProvider>
    );
};

export default Layout;
