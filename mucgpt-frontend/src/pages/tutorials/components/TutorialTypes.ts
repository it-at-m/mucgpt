export interface TutorialNavigationProps {
    onPreviousTutorial?: () => void;
    onNextTutorial?: () => void;
    onBackToTop?: () => void;
    currentTutorialId?: string;
    allTutorials?: Array<{ id: string; title: string }>;
}
export interface TutorialSection {
    id: string;
    label?: string;
    translationKey?: string;
    defaultLabel?: string;
}
