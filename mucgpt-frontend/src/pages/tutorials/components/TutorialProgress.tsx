import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@fluentui/react-components";
import { CheckmarkCircle24Regular } from "@fluentui/react-icons";
import styles from "./TutorialProgress.module.css";

export interface TutorialSection {
    id: string;
    label?: string;
    translationKey?: string;
    defaultLabel?: string;
}

interface TutorialProgressProps {
    currentStep: number;
    totalSteps: number;
    completedSections?: string[];
    onSectionComplete?: (sectionId: string) => void;
    sections?: TutorialSection[];
    title?: string;
    titleTranslationKey?: string;
    defaultTitle?: string;
    isSticky?: boolean;
    stickyOffset?: number;
    showPercentage?: boolean;
    showStats?: boolean;
    compact?: boolean;
    className?: string;
}

export const TutorialProgress: React.FC<TutorialProgressProps> = ({
    currentStep,
    totalSteps,
    completedSections = [],
    onSectionComplete,
    sections,
    title,
    titleTranslationKey,
    defaultTitle,
    isSticky = false,
    stickyOffset = 0,
    showPercentage = true,
    showStats = true,
    compact = false,
    className
}) => {
    const { t } = useTranslation();
    const progressPercentage = (currentStep / totalSteps) * 100;

    // Default sections if none provided
    const defaultSections: TutorialSection[] = [];

    const sectionsToRender = sections || defaultSections;
    const displayTitle =
        title || (titleTranslationKey ? t(titleTranslationKey, defaultTitle || "Tutorial-Fortschritt") : t("tutorials.progress.title", "Tutorial-Fortschritt"));

    const containerClassName = `${styles.progressContainer} ${isSticky ? styles.sticky : ""} ${compact ? styles.compact : ""} ${className || ""}`;
    const containerStyle = isSticky ? { top: `${stickyOffset}px` } : undefined;

    return (
        <div className={containerClassName} style={containerStyle}>
            <div className={styles.progressHeader}>
                <Text as="h4" size={compact ? 200 : 300} weight="semibold">
                    {displayTitle}
                </Text>
                {showStats && (
                    <Text size={compact ? 100 : 200} className={styles.progressStats}>
                        {t("tutorials.progress.stats", "{{completed}} von {{total}} Abschnitten abgeschlossen", {
                            completed: completedSections.length,
                            total: sectionsToRender.length
                        })}
                    </Text>
                )}
            </div>

            <div className={styles.progressBarContainer}>
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }} />
                </div>
                {showPercentage && (
                    <Text size={compact ? 100 : 100} className={styles.progressPercentage}>
                        {Math.round(progressPercentage)}%
                    </Text>
                )}
            </div>

            <div className={styles.sectionsList}>
                {sectionsToRender.map((section, index) => (
                    <div
                        key={section.id}
                        className={`${styles.sectionItem} ${
                            completedSections.includes(section.id) ? styles.completed : index === currentStep ? styles.current : styles.pending
                        }`}
                        onClick={() => {
                            if (onSectionComplete) {
                                onSectionComplete(section.id);
                            }
                            // Scroll to the section
                            const sectionElement = document.getElementById(`section-${section.id}`);
                            if (sectionElement) {
                                const yOffset = -200;
                                const y = sectionElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                window.scrollTo({ top: y, behavior: "smooth" });
                            }
                        }}
                    >
                        <div className={styles.sectionIcon}>
                            {completedSections.includes(section.id) ? <CheckmarkCircle24Regular /> : <span className={styles.sectionNumber}>{index + 1}</span>}
                        </div>
                        <Text size={compact ? 100 : 200} className={styles.sectionLabel}>
                            {section.translationKey
                                ? t(section.translationKey, section.defaultLabel || section.label || section.id)
                                : section.label || section.defaultLabel || section.id}
                        </Text>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TutorialProgress;

// Convenience component for sticky compact progress
export const StickyTutorialProgress: React.FC<Omit<TutorialProgressProps, "isSticky" | "compact">> = props => (
    <TutorialProgress {...props} isSticky={true} compact={true} stickyOffset={60} />
);
