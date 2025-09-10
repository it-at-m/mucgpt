import React from "react";
import { useTranslation } from "react-i18next";
import { Text, Button, Tooltip } from "@fluentui/react-components";
import { CheckmarkCircle24Regular, ChevronLeft24Regular, ChevronRight24Regular, ArrowUp24Regular } from "@fluentui/react-icons";
import styles from "./TutorialProgress.module.css";
import { TutorialSection } from "./TutorialTypes";

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
    /** Enable click-to-scroll functionality for section items */
    enableSectionNavigation?: boolean;
    /** Custom scroll offset when navigating to sections */
    scrollOffset?: number;
    /** Show navigation buttons (back to top, previous, next) */
    showNavigationButtons?: boolean;
    /** Callback when user clicks previous tutorial button */
    onPreviousTutorial?: () => void;
    /** Callback when user clicks next tutorial button */
    onNextTutorial?: () => void;
    /** Callback when user clicks back to top button */
    onBackToTop?: () => void;
    /** Current tutorial ID for tutorial-level navigation */
    currentTutorialId?: string;
    /** All available tutorials for navigation */
    allTutorials?: ReadonlyArray<{ id: string; title: string }>;
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
    className,
    enableSectionNavigation = true,
    scrollOffset = -200,
    showNavigationButtons = true,
    onPreviousTutorial,
    onNextTutorial,
    onBackToTop,
    currentTutorialId,
    allTutorials = []
}) => {
    const { t } = useTranslation();

    // Default sections if none provided
    const defaultSections: TutorialSection[] = [];

    const sectionsToRender = sections || defaultSections;

    const stepsTotal = totalSteps || sectionsToRender.length;

    const completedCount = Math.min(completedSections.length, stepsTotal);

    const progressPercentage = stepsTotal > 0 ? (completedCount / stepsTotal) * 100 : 0;

    const displayTitle =
        title || (titleTranslationKey ? t(titleTranslationKey, defaultTitle || "Tutorial-Fortschritt") : t("tutorials.progress.title", "Tutorial-Fortschritt"));

    const containerClassName = `${styles.progressContainer} ${isSticky ? styles.sticky : ""} ${compact ? styles.compact : ""} ${className || ""}`;
    const containerStyle = isSticky ? { top: `${stickyOffset}px` } : undefined;

    // Navigation logic for tutorials
    const currentTutorialIndex = currentTutorialId ? allTutorials.findIndex(t => t.id === currentTutorialId) : -1;
    const canGoToPrevious = currentTutorialIndex > 0;
    const canGoToNext = currentTutorialIndex >= 0 && currentTutorialIndex < allTutorials.length - 1;

    const handleBackToTop = () => {
        if (onBackToTop) {
            onBackToTop();
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handlePreviousTutorial = () => {
        if (onPreviousTutorial) {
            onPreviousTutorial();
            // Scroll to top after navigation using scrollOffset
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handleNextTutorial = () => {
        if (onNextTutorial) {
            onNextTutorial();
            // Scroll to top after navigation using scrollOffset
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    return (
        <div className={containerClassName} style={containerStyle}>
            <div className={styles.progressHeader}>
                <div className={styles.progressTitleContainer}>
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

                {showNavigationButtons && (
                    <div className={styles.navigationButtons}>
                        <Tooltip content={t("tutorials.navigation.back_to_top", "Zum Seitenanfang")} relationship="description">
                            <Button
                                appearance="subtle"
                                icon={<ArrowUp24Regular />}
                                size={compact ? "small" : "medium"}
                                onClick={handleBackToTop}
                                className={styles.navigationButton}
                                aria-label={t("tutorials.navigation.back_to_top", "Zum Seitenanfang")}
                            />
                        </Tooltip>

                        <Tooltip content={t("tutorials.navigation.previous_tutorial", "Vorheriges Tutorial")} relationship="description">
                            <Button
                                appearance="subtle"
                                icon={<ChevronLeft24Regular />}
                                size={compact ? "small" : "medium"}
                                onClick={handlePreviousTutorial}
                                disabled={!canGoToPrevious}
                                className={styles.navigationButton}
                                aria-label={t("tutorials.navigation.previous_tutorial", "Vorheriges Tutorial")}
                            />
                        </Tooltip>

                        <Tooltip content={t("tutorials.navigation.next_tutorial", "Nächstes Tutorial")} relationship="description">
                            <Button
                                appearance="subtle"
                                icon={<ChevronRight24Regular />}
                                size={compact ? "small" : "medium"}
                                onClick={handleNextTutorial}
                                disabled={!canGoToNext}
                                className={styles.navigationButton}
                                aria-label={t("tutorials.navigation.next_tutorial", "Nächstes Tutorial")}
                            />
                        </Tooltip>
                    </div>
                )}
            </div>

            <div className={styles.progressBarContainer}>
                <div
                    className={styles.progressBar}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressPercentage)}
                    aria-label={t("tutorials.progress.aria_label", "Tutorial-Fortschritt")}
                >
                    <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }} />
                </div>
                {showPercentage && (
                    <Text size={100} className={styles.progressPercentage}>
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
                            if (enableSectionNavigation) {
                                if (onSectionComplete) {
                                    onSectionComplete(section.id);
                                }
                                // Scroll to the section
                                const sectionElement = document.getElementById(`section-${section.id}`);
                                if (sectionElement) {
                                    const y = sectionElement.getBoundingClientRect().top + window.pageYOffset + scrollOffset;
                                    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                                }
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
    <TutorialProgress {...props} isSticky={true} compact={true} stickyOffset={60} showNavigationButtons={true} />
);
