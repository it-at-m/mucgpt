import { Outlet, NavLink, Link } from "react-router-dom";


import styles from "./Layout.module.css";
import { SparkleFilled } from "@fluentui/react-icons";

const Layout = () => {
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
                            {/* <li>
                                <NavLink to="/" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Chat
                                </NavLink>
                            </li>
                            <li className={styles.headerNavLeftMargin}>
                                <NavLink to="/qa" className={({ isActive }) => (isActive ? styles.headerNavPageLinkActive : styles.headerNavPageLink)}>
                                    Ask a question
                                </NavLink>
                            </li>
                             */}
                        </ul>
                    </nav>
                </div>
            </header>

            <Outlet />
        </div>
    );
};

export default Layout;
