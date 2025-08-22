import { ReactNode } from "react";
import styles from "./BaseFragment.module.css";

export interface FragmentProps {
    title: string;
    content: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}

export const BaseFragment = ({ title, content, actions, children, className }: FragmentProps) => {
    const containerClass = className ? `${styles.fragmentContainer} ${className}` : styles.fragmentContainer;

    return (
        <div className={containerClass}>
            <div className={styles.fragmentHeader}>
                <h3 className={styles.fragmentTitle}>{title}</h3>
                {actions && <div className={styles.fragmentActions}>{actions}</div>}
            </div>
            <div className={styles.fragmentContent}>{children || <div className={styles.fragmentBody}>{content}</div>}</div>
        </div>
    );
};
