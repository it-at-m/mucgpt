import React from "react";
import { AssistantResponse } from "../../api/models";
import styles from "./BotStats.module.css";

interface BotStatsProps {
    bot: AssistantResponse;
}

export const BotStats: React.FC<BotStatsProps> = ({ bot }) => {
    const { latest_version, hierarchical_access } = bot;

    // Format visibility
    const visibility = latest_version.is_visible ? "Sichtbar" : "Unsichtbar";

    // Format publication type
    const getPublicationType = () => {
        if (!hierarchical_access || hierarchical_access.length === 0) {
            return "Öffentlich";
        }

        const departmentText = hierarchical_access.join(", ");
        const maxLength = 50; // Maximum characters to display

        if (departmentText.length > maxLength) {
            return "Sichtbar für " + hierarchical_access.length + " Abteilungen";
        }

        return departmentText;
    };

    return (
        <div className={styles.statsContainer}>
            <div className={styles.statsTitle}>Bot-Statistiken</div>
            <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Sichtbarkeit:</span>
                    <span className={`${styles.statValue} ${latest_version.is_visible ? styles.visible : styles.invisible}`}>{visibility}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Veröffentlichung:</span>
                    <span className={styles.statValue}>{getPublicationType()}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Abonnements:</span>
                    <span className={styles.statValue}>{bot.subscriptions_count}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Version:</span>
                    <span className={styles.statValue}>v{latest_version.version}</span>
                </div>
            </div>
        </div>
    );
};
