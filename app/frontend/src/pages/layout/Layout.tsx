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

    useEffect(() => {
        configApi().then(result => {
            setConfig(result)
        }, () => { console.log("Config nicht geladen") });
    })


    const onLanguageSelectionChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let lang = selection.optionValue || DEFAULTLANG;
        i18n.changeLanguage(lang);
        setLanguage(lang);
    };
    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerNavList}>

                    <Link to="/" className={styles.headerTitleContainer}>
                        <img
                            src={logo}
                            alt="MUCGPT logo"
                            aria-label="Link to github repository"
                            className={styles.logo}
                        ></img>
                        <h2 className={styles.headerTitle}>MUCGPT</h2>
                        <h2 className={styles.headerTitle}>{config.frontend.labels.env_name}</h2>
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

                    <div className={styles.spacer}>

                    </div>
                    <SettingsDrawer defaultlang={DEFAULTLANG} onLanguageSelectionChanged={onLanguageSelectionChanged} version={config.version}></SettingsDrawer>
                </div>
            </header>
            <Outlet />

            <footer className={styles.footer} role={"banner"}>
                <div className={styles.headerNavLeftMargin}>
                    Landeshauptstadt München <br />
                    RIT/it@M Innovationlab <br />
                </div>
                <div className={styles.headerNavRightMargin}>
                    <TermsOfUseDialog ></TermsOfUseDialog>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
