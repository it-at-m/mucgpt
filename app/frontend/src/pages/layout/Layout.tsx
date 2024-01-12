import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { useContext, useEffect, useState } from "react";
import logo from "../../assets/mucgpt_logo.png";

import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from 'react-i18next';
import { ApplicationConfig, configApi } from "../../api";
import { SettingsDrawer } from "../../components/SettingsDrawer";
import Snowfall from 'react-snowfall'
import { CheckboxProps } from "@fluentui/react-components";

import { FluentProvider, BrandVariants, createLightTheme, createDarkTheme, teamsHighContrastTheme, makeStyles } from '@fluentui/react-components';
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
    const [snowFlakeCount, setSnowFlakeCount] = useState<number>(50);
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

    const customLightTheme = createLightTheme(customBrandRamp);
    const customDarkTheme = createDarkTheme(customBrandRamp);
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

        <FluentProvider theme={customLightTheme}>

            <div className={styles.layout}>
                {enableSnow &&
                    <Snowfall color="white" snowflakeCount={snowFlakeCount} changeFrequency={300} radius={[0.5, 5.5]} />
                }
                <header className={styles2.header} role={"banner"}>
                    <div className={styles.headerNavList}>

                        <Link to="/" className={styles.headerTitleContainer}>
                            <img
                                src={logo}
                                alt="MUCGPT logo"
                                aria-label="Link to github repository"
                                className={styles.logo}
                            ></img>
                            <h3 className={styles.headerTitle}>{config.frontend.labels.env_name}</h3>
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
                        <SettingsDrawer defaultlang={DEFAULTLANG} onLanguageSelectionChanged={onLanguageSelectionChanged} version={config.version} enableSnow={enableSnow} onEnableSnowChanged={(ev, data) => setSnow(data.checked)}></SettingsDrawer>
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
