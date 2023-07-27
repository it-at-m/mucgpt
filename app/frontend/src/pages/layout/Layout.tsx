import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { SparkleFilled } from "@fluentui/react-icons";
import { LanguageSelector } from "../../components/LanguageSelector";
import { useContext } from "react";

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
                    <div className={styles.headerContainer}>
                    <SparkleFilled fontSize={"60px"} primaryFill={"rgba(255, 204, 0, 1)"} aria-hidden="true" aria-label="Chat logo" />
                        
                        <Link to="/" className={styles.headerTitleContainer}>
                            <h2 className={styles.headerTitle}>MUCGPT</h2>
                        </Link>
                        <nav>
                            <ul className={styles.headerNavList}>
                                <li>
                                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.chat')}
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/sum"   state={{from: "This is my props"}} className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.sum')}
                                    </NavLink>
                                </li>
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
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/brainstorm" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    {t('header.brainstorm')}
                                    </NavLink>
                                </li>
                            </ul>
                        </nav>
                        <div className={styles.headerNavRightMargin}><LanguageSelector defaultlang={DEFAULTLANG} onSelectionChange={onLanguageSelectionChanged}></LanguageSelector></div>
                    </div>
                </header>
            <Outlet />
  
            <footer className={styles.footer} role={"banner"}>
                <div>
                    Landeshauptstadt München <br/>
                    RIT/IT@M Innovationlab<br/>
                </div>
                <TermsOfUseDialog></TermsOfUseDialog>
            </footer>
        </div>
    );
};

export default Layout;
