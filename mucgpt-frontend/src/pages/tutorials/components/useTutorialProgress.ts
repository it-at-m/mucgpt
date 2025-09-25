import * as React from "react";
import { TutorialSection } from "./TutorialTypes";

interface UseTutorialProgressOptions {
    sections: TutorialSection[];
    observerDelay?: number;
    intersectionThreshold?: number[];
    rootMargin?: string;
}

interface UseTutorialProgressReturn {
    currentStep: number;
    completedSections: string[];
    handleSectionComplete: (sectionId: string) => void;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
    setCompletedSections: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Custom hook that provides tutorial progress tracking functionality.
 * Handles state management, section completion, and intersection observer setup.
 */
export const useTutorialProgress = ({
    sections,
    observerDelay = 1000,
    intersectionThreshold = [0.1, 0.3, 0.5],
    rootMargin = "0px 0px -100px 0px"
}: UseTutorialProgressOptions): UseTutorialProgressReturn => {
    const [currentStep, setCurrentStep] = React.useState<number>(0);
    const [completedSections, setCompletedSections] = React.useState<string[]>([]);

    // Function to mark a section as completed
    const handleSectionComplete = React.useCallback(
        (sectionId: string) => {
            setCompletedSections(prev => {
                if (prev.includes(sectionId)) {
                    return prev; // Already completed, no change
                }
                const newCompleted = [...prev, sectionId];

                // Auto-advance step based on section completion
                const sectionIndex = sections.findIndex(section => section.id === sectionId);
                if (sectionIndex !== -1) {
                    setCurrentStep(prevStep => Math.max(prevStep, sectionIndex + 1));
                }

                return newCompleted;
            });
        },
        [sections]
    );

    // Intersection Observer for section completion
    React.useEffect(() => {
        const setupObserver = () => {
            const sectionElements = sections
                .map(section => document.getElementById(`section-${section.id}`))
                .filter((element): element is HTMLElement => element !== null);

            if (sectionElements.length === 0) return null;

            const observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && entry.intersectionRatio > (intersectionThreshold[0] || 0.1)) {
                            const sectionId = entry.target.id.replace("section-", "");
                            if (sectionId && sections.some(section => section.id === sectionId)) {
                                handleSectionComplete(sectionId);
                            }
                        }
                    });
                },
                {
                    threshold: intersectionThreshold,
                    rootMargin
                }
            );

            sectionElements.forEach(element => {
                if (element) observer.observe(element);
            });

            return observer;
        };

        let observer: IntersectionObserver | null = null;
        const timer = setTimeout(() => {
            observer = setupObserver();
        }, observerDelay);

        return () => {
            clearTimeout(timer);
            if (observer) {
                sections.forEach(section => {
                    const element = document.getElementById(`section-${section.id}`);
                    if (element && observer) observer.unobserve(element);
                });
                observer.disconnect();
            }
        };
    }, [sections, handleSectionComplete, observerDelay, intersectionThreshold, rootMargin]);

    return {
        currentStep,
        completedSections,
        handleSectionComplete,
        setCurrentStep,
        setCompletedSections
    };
};
