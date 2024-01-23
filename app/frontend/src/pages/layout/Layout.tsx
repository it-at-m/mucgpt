import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { useContext, useEffect, useState } from "react";
import logo from "../../assets/mucgpt_logo.png";
import logo_black from "../../assets/mucgpt_black.png";

import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from 'react-i18next';
import { ApplicationConfig, configApi } from "../../api";
import { SettingsDrawer } from "../../components/SettingsDrawer";
import { CheckboxProps } from "@fluentui/react-components";

import { FluentProvider, BrandVariants, createLightTheme, createDarkTheme, Theme, makeStyles } from '@fluentui/react-components';
import { tokens } from '@fluentui/react-theme';

const useStyles = makeStyles({
    footer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: "auto",
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorNeutralBackground1
    },
    header: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2
    }
});
const Layout = () => {
    const { language, setLanguage } = useContext(LanguageContext);
    const { t, i18n } = useTranslation();
    const [config, setConfig] = useState<ApplicationConfig>({
        backend: {
            features: {
                enable_auth: true
            }
        },
        frontend: {
            features: {},
            labels: {
                env_name: "PILOT-C"
            }
        },
        version: "0.1.0"
    }
    )
    const [enableSnow, setSnow] = useState<CheckboxProps["checked"]>(true);
    const [isLight, setLight] = useState<boolean>(true);
    const [snowFlakeCount, setSnowFlakeCount] = useState<number>(50);
    const [fontscaling, setFontscaling] = useState<number>(1.0);
    const customBrandRamp: BrandVariants = {
        10: '#f2f2f2',
        20: '#e4e4e5',
        30: '#d6d6d8',
        40: '#c8c8cb',
        50: '#bababe',
        60: '#acacb1',
        70: '#9e9ea4',
        80: '#909097',
        90: '#82828a',
        100: '#74747d',
        110: '#666670',
        120: '#585863',
        130: '#4a4a56',
        140: '#3c3c49',
        150: '#2e2e3c',
        160: '#212529',
    };
    const adjustTheme = (isLight: boolean, scaling: number) => {
        let theme = isLight ? createLightTheme(customBrandRamp) : createDarkTheme(customBrandRamp);
        theme.fontSizeBase100 = (parseFloat(theme.fontSizeBase100.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeBase200 = (parseFloat(theme.fontSizeBase200.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeBase300 = (parseFloat(theme.fontSizeBase300.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeBase400 = (parseFloat(theme.fontSizeBase400.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeBase500 = (parseFloat(theme.fontSizeBase500.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeBase600 = (parseFloat(theme.fontSizeBase600.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeHero700 = (parseFloat(theme.fontSizeHero700.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeHero800 = (parseFloat(theme.fontSizeHero800.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeHero900 = (parseFloat(theme.fontSizeHero900.replace("px", "")) * scaling).toString() + "px";
        theme.fontSizeHero1000 = (parseFloat(theme.fontSizeHero1000.replace("px", "")) * scaling).toString() + "px";

        theme.lineHeightBase100 = (parseFloat(theme.lineHeightBase100.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightBase200 = (parseFloat(theme.lineHeightBase200.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightBase300 = (parseFloat(theme.lineHeightBase300.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightBase400 = (parseFloat(theme.lineHeightBase400.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightBase500 = (parseFloat(theme.lineHeightBase500.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightBase600 = (parseFloat(theme.lineHeightBase600.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightHero700 = (parseFloat(theme.lineHeightHero700.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightHero800 = (parseFloat(theme.lineHeightHero800.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightHero900 = (parseFloat(theme.lineHeightHero900.replace("px", "")) * scaling).toString() + "px";
        theme.lineHeightHero1000 = (parseFloat(theme.lineHeightHero1000.replace("px", "")) * scaling).toString() + "px";
        return theme;
    };

    const [theme, setTheme] = useState<Theme>(adjustTheme(true, fontscaling));



    const onFontscaleChange = (fontscale: number) => {
        setFontscaling(fontscale);
        setTheme(adjustTheme(isLight, fontscale));
    }


    const styles2 = useStyles();

    useEffect(() => {
        configApi().then(result => {
            setConfig(result)
        }, () => { console.log("Config nicht geladen") });
    }, [])


    const onLanguageSelectionChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let lang = selection.optionValue || DEFAULTLANG;
        i18n.changeLanguage(lang);
        setLanguage(lang);
    };
    return (

        <FluentProvider theme={theme}>

            <div className={styles.layout}>
                <header className={styles2.header} role={"banner"}>
                    <div className={styles.headerNavList}>

                        <Link to="/" className={styles.headerTitleContainer}>
                            <img
                                src={isLight ? logo : logo_black}
                                alt="MUCGPT logo"
                                aria-label="MUCGPT Logo"
                                className={styles.logo}
                            ></img>
                            <h3 className={styles.headerTitle} aria-description="Umgebung:">{config.frontend.labels.env_name}</h3>
                        </Link>

                        <div className={styles.headerNavLeftMargin}>
                            <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
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
                        <SettingsDrawer
                            defaultlang={DEFAULTLANG}
                            onLanguageSelectionChanged={onLanguageSelectionChanged}
                            version={config.version}
                            onEnableSnowChanged={(ev, data) => setSnow(data.checked)}
                            fontscale={fontscaling}
                            setFontscale={onFontscaleChange}
                            isLight={isLight}
                            setTheme={(light) => { setLight(light); setTheme(adjustTheme(light, fontscaling)) }}></SettingsDrawer>
                    </div>
                </header>
                <Outlet />

                <footer className={styles2.footer} role={"banner"}>
                    <div >
                        Landeshauptstadt München <br />
                        RIT/it@M Innovationlab <br />
                    </div>
                    <div className={styles.headerNavRightMargin}>
                        <TermsOfUseDialog ></TermsOfUseDialog>
                    </div>
                </footer>
            </div>
        </FluentProvider>
    );
};

export default Layout;
