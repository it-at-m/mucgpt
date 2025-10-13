import { ReactNode } from "react";
import styles from "./Sidebar.module.css";
interface Props {
    actions: ReactNode;
    content: ReactNode;
}

export const Sidebar = ({ actions, content }: Props) => {
    return (
        <div className={styles.drawer}>
            <div className={styles.header} role="heading" aria-level={3}>
                <div className={styles.actionRow}>{actions}</div>
            </div>
            <div className={styles.drawerContent}>{content}</div>
        </div>
    );
};
