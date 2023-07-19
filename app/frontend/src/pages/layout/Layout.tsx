import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { SparkleFilled } from "@fluentui/react-icons";
import { LanguageSelector } from "../../components/LanguageSelector";
import { useContext, useState } from "react";

import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import React from "react";
import { DEFAULTLANG, LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
const Layout = () => {
    const { language, setLanguage } = useContext(LanguageContext);

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
                                    <NavLink to="/sum"   state={{from: "This is my props"}} className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Zusammenfassen
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/explain" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Erklären
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/code" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                        Programmieren
                                    </NavLink>
                                </li>
                                <li className={styles.headerNavLeftMargin}>
                                    <NavLink to="/brainstorm" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Brainstorming
                                        {/*  https://www.w3schools.com/gen_ai/chatgpt-4/chatgpt-4_brainstorming.php  https://faun.pub/effortless-diagrams-unlocked-streamline-diagram-creation-with-chatgpt-mermaid-82ed44f3a9a6*/}
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
