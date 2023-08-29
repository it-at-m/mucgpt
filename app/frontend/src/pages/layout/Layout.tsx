import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { LanguageSelector } from "../../components/LanguageSelector";
import { useContext } from "react";
import logo from "../../assets/mucgpt_logo.png";

import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { TermsOfUseDialog } from "../../components/TermsOfUseDialog";
import { useTranslation } from 'react-i18next';

const Layout = () => {
    const { language, setLanguage } = useContext(LanguageContext);
    const { t, i18n } = useTranslation ();

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
                                        />
                                    <h2 className={styles.headerTitle}>MUCGPT</h2>
                                </Link>
                                
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.chat')}
                                    </NavLink>
                                </div>
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/sum"   state={{from: "This is my props"}} className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.sum')}
                                    </NavLink>
                                </div>
{/*                                 <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/explain" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Erklären
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/code" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Programmieren
                                    </NavLink>
                                </li> */}
                                <div className={styles.headerNavLeftMargin}>
                                    <NavLink to="/brainstorm" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.brainstorm')}
                                    </NavLink>
                                </div>
                                
                                <div className={styles.spacer}>

                                </div>
                                <div className={styles.headerNavRightMargin}><LanguageSelector defaultlang={DEFAULTLANG} onSelectionChange={onLanguageSelectionChanged}></LanguageSelector>
                                </div>
                            </div>
                </header>
            <Outlet />
  
            <footer className={styles.footer} role={"banner"}>
                <div className={styles.headerNavLeftMargin}>
                    Landeshauptstadt München <br/>
                    RIT/IT@M Innovationlab<br/>
                </div>
                <div className={styles.headerNavRightMargin}>
                    <TermsOfUseDialog ></TermsOfUseDialog>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
