import React from "react";
import { useTranslation } from "react-i18next";
import { AssistantResponse } from "../../api/models";
import styles from "./BotStats.module.css";

interface BotStatsProps {
    bot: AssistantResponse;
}

export const BotStats: React.FC<BotStatsProps> = ({ bot }) => {
    const { t } = useTranslation();
    const { latest_version, hierarchical_access } = bot;

    // Format visibility
    const visibility = latest_version.is_visible
        ? t("components.bot_stats.visibility_visible", "Sichtbar")
        : t("components.bot_stats.visibility_invisible", "Unsichtbar");

    // Format publication type
    const getPublicationType = () => {
        if (!hierarchical_access || hierarchical_access.length === 0) {
            return t("components.bot_stats.publication_public", "Öffentlich");
        }

        const departmentText = hierarchical_access.join(", ");
        const maxLength = 50; // Maximum characters to display

        if (departmentText.length > maxLength) {
            return t("components.bot_stats.publication_departments", "Sichtbar für {{count}} Abteilungen", {
                count: hierarchical_access.length
            });
        }

        return departmentText;
    };

    return (
        <div className={styles.statsContainer}>
            <div className={styles.statsTitle}>{t("components.bot_stats.title", "Bot-Statistiken")}</div>
            <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>{t("components.bot_stats.visibility_label", "Sichtbarkeit:")}</span>
                    <span className={`${styles.statValue} ${latest_version.is_visible ? styles.visible : styles.invisible}`}>{visibility}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>{t("components.bot_stats.publication_label", "Veröffentlichung:")}</span>
                    <span className={styles.statValue}>{getPublicationType()}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>{t("components.bot_stats.subscriptions_label", "Abonnements:")}</span>
                    <span className={styles.statValue}>{bot.subscriptions_count}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>{t("components.bot_stats.version_label", "Version:")}</span>
                    <span className={styles.statValue}>v{latest_version.version}</span>
                </div>
            </div>
        </div>
    );
};
