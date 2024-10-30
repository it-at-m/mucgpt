import { Outlet, NavLink, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import styles from "./Layout.module.css";
import { useContext, useEffect, useState } from "react";
import logo from "../../assets/mucgpt_logo.png";
import alternative_logo from "../../assets/mugg_tschibidi.png";
import logo_black from "../../assets/mucgpt_black.png";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from 'react-i18next';
import { ApplicationConfig, configApi } from "../../api";
import { SettingsDrawer } from "../../components/SettingsDrawer";
import { FluentProvider, Theme } from '@fluentui/react-components';
import { useStyles, STORAGE_KEYS, adjustTheme } from "./LayoutHelper";
import { DEFAULTLLM, LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { getBotName } from "../../service/storage";

const formatDate = (date: Date) => {
    let formatted_date =
        date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear()
    return formatted_date;
}



export const Layout = () => {
    const { id } = useParams();
    const styles2 = useStyles();
    const navigate = useNavigate()
    const termsofuseread = localStorage.getItem(STORAGE_KEYS.TERMS_OF_USE_READ) === formatDate(new Date());
    const language_pref = (localStorage.getItem(STORAGE_KEYS.SETTINGS_LANGUAGE)) || DEFAULTLANG;
    const [config, setConfig] = useState<ApplicationConfig>({
        models: [{
            "llm_name": "KICC GPT",
            "max_input_tokens": 128000,
            "max_output_tokens": 128000,
            "description": ""
        },
        {
            "llm_name": "Unknown GPT",
            "max_input_tokens": 128000,
            "max_output_tokens": 128000,
            "description": ""
        }],
        frontend: {
            labels: {
                "env_name": "MUC tschibidi-C"
            },
            alternative_logo: true,
            enable_simply: true
        },
        version: "DEV 1.0.0"
    });
    const llm_pref = (localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM)) || config.models[0].llm_name;
    const font_scaling_pref = Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_FONT_SCALING)) || 1;
    const ligth_theme_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == 'true';
    const { language, setLanguage } = useContext(LanguageContext);
    const { LLM, setLLM } = useContext(LLMContext);
    const { t, i18n } = useTranslation();
    const [isLight, setLight] = useState<boolean>(ligth_theme_pref);
    const [fontscaling, setFontscaling] = useState<number>(font_scaling_pref);
    const [simply, setSimply] = useState<boolean>(true);

    const [models, setModels] = useState(config.models);
    const [theme, setTheme] = useState<Theme>(adjustTheme(isLight, fontscaling));

    const [title, setTitle] = useState<string>("");


    const onFontscaleChange = (fontscale: number) => {
        setFontscaling(fontscale);
        setTheme(adjustTheme(isLight, fontscale));
        localStorage.setItem(STORAGE_KEYS.SETTINGS_FONT_SCALING, fontscale.toString());
    };

    const onThemeChange = (light: boolean) => {
        setLight(light);
        localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, String(light));
        setTheme(adjustTheme(light, fontscaling));
    };

    useEffect(() => {
        if (id) {
            getBotName(+id).then(title => {
                setTitle(title);
            });
        }
        configApi().then(result => {
            setConfig(result);
            setModels(result.models);
            setSimply(result.frontend.enable_simply);
            if (result.models.length === 0) {
                console.error("Keine Modelle vorhanden");
            }
            setLLM(result.models.find((model) => model.llm_name == llm_pref) || result.models[0])
        }, () => { console.error("Config nicht geladen"); });
        i18n.changeLanguage(language_pref);
    }, []);

    useEffect(() => {
        if (id) {
            getBotName(+id).then(title => {
                setTitle(title);
            });
        }
    }, [id]);

    const onAcceptTermsOfUse = () => {
        localStorage.setItem(STORAGE_KEYS.TERMS_OF_USE_READ, formatDate(new Date()));
        if (localStorage.getItem(STORAGE_KEYS.VERSION_UPDATE_SEEN) !== config.version) {
            localStorage.setItem(STORAGE_KEYS.VERSION_UPDATE_SEEN, config.version);
            navigate('version');
        }
    };

    const onLanguageSelectionChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let lang = selection.optionValue || DEFAULTLANG;
        i18n.changeLanguage(lang);
        setLanguage(lang);
        localStorage.setItem(STORAGE_KEYS.SETTINGS_LANGUAGE, lang);
    };
    const onLLMSelectionChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let llm = selection.optionValue || DEFAULTLLM;
        let found_llm = models.find((model) => model.llm_name == llm);
        if (found_llm) {
            setLLM(found_llm);
            localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, llm);
        }

    };

    return (

        <FluentProvider theme={theme}>

            <div className={styles.layout}>
                <header className={styles2.header} role={"banner"} >
                    <div className={styles.header}>
                        <Link to="/" className={styles.headerTitleContainer}>
                            <img
                                src={config.frontend.alternative_logo ? alternative_logo : (isLight ? logo : logo_black)}
                                alt="MUCGPT logo"
                                aria-label="MUCGPT Logo"
                                className={styles.logo}
                            ></img>
                            <h3 className={styles.headerTitle} aria-description="Umgebung:">{config.frontend.labels.env_name}</h3>
                        </Link>
                        <div className={styles.headerNavList}>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    MUCGPT
                                </NavLink>
                            </div>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/bot" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {title}
                                </NavLink>
                            </div>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/create" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.create_bot')}
                                </NavLink>
                            </div>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/chat" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.chat')}
                                </NavLink>
                            </div>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/sum" state={{ from: "This is my props" }} className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.sum')}
                                </NavLink>
                            </div>
                            <div className={styles.headerNavLeftMargin}>
                                <NavLink to="/brainstorm" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.brainstorm')}
                                </NavLink>
                            </div>
                            {simply &&
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/simply" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        {t('header.simply')}
                                    </NavLink>
                                </div>
                            }
                        </div>
                        <div className={styles.SettingsDrawer}>
                            <SettingsDrawer
                                defaultlang={language_pref}
                                onLanguageSelectionChanged={onLanguageSelectionChanged}
                                version={config.version}
                                fontscale={fontscaling}
                                setFontscale={onFontscaleChange}
                                isLight={isLight}
                                setTheme={onThemeChange}
                                defaultLLM={llm_pref}
                                onLLMSelectionChanged={onLLMSelectionChanged}
                                llmOptions={models}
                                currentLLM={LLM}
                            ></SettingsDrawer>
                        </div>
                    </div>
                </header>
                <Outlet />

                <footer className={styles2.footer} role={"banner"}>
                    <div>
                        Landeshauptstadt München <br />
                        RIT/it@M KICC <br />
                    </div>
                    <div className={styles.headerNavRightMargin}>
                        <TermsOfUseDialog defaultOpen={!termsofuseread} onAccept={onAcceptTermsOfUse}></TermsOfUseDialog>
                    </div>
                </footer>
            </div>
        </FluentProvider >
    );
};

export default Layout;
