import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { SparkleFilled } from "@fluentui/react-icons";
import { LanguageSelector } from "../../components/LanguageSelector";
import { useState } from "react";

import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";

const Layout = () => {
    const DEFAULTLANG = "Deutsch";
    const [language, setLanguage] = useState<string>(DEFAULTLANG);

    const onLanguageSelectionChanged = (e: SelectionEvents, selection: OptionOnSelectData) => {
        setLanguage(selection.optionValue || DEFAULTLANG);
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
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/sum" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Zusammenfassen
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Erklären
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Programmieren
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                    <div className={styles.headerNavRightMargin}><LanguageSelector defaultlang={DEFAULTLANG} onSelectionChange={onLanguageSelectionChanged}></LanguageSelector></div>
                </div>
            </header>

            <Outlet />
        </div>
    );
};

export default Layout;
