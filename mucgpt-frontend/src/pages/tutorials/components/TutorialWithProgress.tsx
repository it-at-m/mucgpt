import React from "react";
import { useTranslation } from "react-i18next";
import TutorialProgress from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import { TutorialSection } from "./TutorialTypes";

interface TutorialWithProgressProps {
    /** Tutorial sections configuration */
    sections: TutorialSection[];
    /** Translation key for progress title */
    titleTranslationKey?: string;
    /** Default title if translation is not available */
    defaultTitle?: string;
    /** Whether to show the progress as sticky */
    isSticky?: boolean;
    /** Sticky offset from top */
    stickyOffset?: number;
    /** Whether to show percentage */
    showPercentage?: boolean;
    /** Whether to show completion stats */
    showStats?: boolean;
    /** Whether to use compact mode */
    compact?: boolean;
    /** Additional className for progress container */
    className?: string;
    /** Children components that will be rendered with section IDs for tracking */
    children: React.ReactNode;
    /** Observer setup delay */
    observerDelay?: number;
    /** Intersection threshold for section detection */
    intersectionThreshold?: number[];
    /** Root margin for intersection observer */
    rootMargin?: string;
}

/**
 * Higher-order component that provides tutorial progress functionality.
 * Wraps content with progress tracking and renders a TutorialProgress component.
 */
export const TutorialWithProgress: React.FC<TutorialWithProgressProps> = ({
    sections,
    titleTranslationKey,
    defaultTitle,
    isSticky = true,
    stickyOffset = 50,
    showPercentage = true,
    showStats = true,
    compact = true,
    className,
    children,
    observerDelay,
    intersectionThreshold,
    rootMargin
}) => {
    const { t } = useTranslation();

    const { currentStep, completedSections, handleSectionComplete } = useTutorialProgress({
        sections,
        observerDelay,
        intersectionThreshold,
        rootMargin
    });

    const displayTitle = titleTranslationKey
        ? t(titleTranslationKey, defaultTitle || "Tutorial-Fortschritt")
        : defaultTitle || t("tutorials.progress.title", "Tutorial-Fortschritt");

    return (
        <div>
            <TutorialProgress
                currentStep={currentStep}
                totalSteps={sections.length}
                completedSections={completedSections}
                onSectionComplete={handleSectionComplete}
                sections={sections}
                title={displayTitle}
                isSticky={isSticky}
                stickyOffset={stickyOffset}
                showPercentage={showPercentage}
                showStats={showStats}
                compact={compact}
                className={className}
            />
            {children}
        </div>
    );
};
