import { useState, useCallback, useRef } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { BrainCircuit24Regular, Send24Regular } from "@fluentui/react-icons";
import { BaseTutorial, TutorialTip } from "./BaseTutorial";
import TutorialProgress, { TutorialSection } from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import { AnswerList } from "../../../components/AnswerList/AnswerList";
import { Answer } from "../../../components/Answer";
import { ChatMessage } from "../../chat/Chat";
import styles from "./BaseTutorial.module.css";

interface TutorialNavigationProps {
    onPreviousTutorial?: () => void;
    onNextTutorial?: () => void;
    onBackToTop?: () => void;
    currentTutorialId?: string;
    allTutorials?: Array<{ id: string; title: string }>;
}

// Example mindmap content for demonstration
const EXAMPLE_MINDMAP = `
\`\`\`MUCGPTBrainstorming
# Nachhaltiger Transport

## **Öffentliche Verkehrsmittel**

### Vorteile

- Reduzierung von CO2-Emissionen
- Kostengünstiger als Privatautos
- Weniger Verkehrsstaus
  - Bessere Luftqualität
  - Schnellere Reisezeiten

### Herausforderungen

- Begrenzte Routen in ländlichen Gebieten
- Wartungskosten
- Pünktlichkeit

## **Elektrofahrzeuge**

### Technologie

- Batterietechnologie
  - Lithium-Ionen-Batterien
  - Solid-State-Batterien
- Ladeinfrastruktur
  - Schnellladestationen
  - Heimladegeräte

### Umweltauswirkungen

- Null Emissionen beim Fahren
- Abhängigkeit von der Stromquelle
- Batterieentsorgung

## **Alternative Transportmittel**

### Fahrräder

- Gesundheitsvorteile
- Umweltfreundlich
- Kostengünstig
  - Keine Treibstoffkosten
  - Geringe Wartungskosten

### E-Scooter

- Flexibilität in der Stadt
- Sharing-Modelle
- Regulierungsherausforderungen
\`\`\`MUCGPTBrainstorming`;
// Create a more realistic brainstorm workflow example
const createBrainstormWorkflowExample = (): ChatMessage[] => {
    return [
        {
            user: "Erstelle eine Mindmap zum Thema 'Nachhaltiger Transport'",
            response: {
                answer: `

${EXAMPLE_MINDMAP}
`,
                activeTools: [
                    {
                        name: "brainstorm",
                        message: "Generiere strukturierte Mindmap für nachhaltigen Transport",
                        state: "ENDED" as const,
                        timestamp: Date.now() - 3000
                    }
                ]
            }
        }
    ];
};

export const BrainstormTutorial = ({ onPreviousTutorial, onNextTutorial, onBackToTop, currentTutorialId, allTutorials }: TutorialNavigationProps = {}) => {
    const { t } = useTranslation();
    const [showExample, setShowExample] = useState(false);
    const chatMessageStreamEnd = useRef<HTMLDivElement>(null);
    const lastQuestionRef = useRef<string>("");

    // Tutorial sections for progress tracking
    const tutorialSections = React.useMemo<TutorialSection[]>(
        () => [
            { id: "intro", translationKey: "tutorials.brainstorm.sections.titles.intro", defaultLabel: "Einführung" },
            { id: "example", translationKey: "tutorials.brainstorm.sections.titles.example", defaultLabel: "Beispiel" },
            { id: "tips", translationKey: "tutorials.brainstorm.sections.titles.tips", defaultLabel: "Tipps" }
        ],
        []
    );

    // Use the custom hook for progress tracking
    const { currentStep, completedSections, handleSectionComplete } = useTutorialProgress({ sections: tutorialSections });

    // Mark intro section as complete on mount since it's visible by default
    React.useEffect(() => {
        const timer = setTimeout(() => {
            handleSectionComplete("intro");
            handleSectionComplete("tips"); // Tips are always visible
        }, 500);
        return () => clearTimeout(timer);
    }, [handleSectionComplete]);

    const toggleExample = useCallback(() => {
        setShowExample(!showExample);
        if (!showExample) {
            handleSectionComplete("example");
        }
    }, [showExample, handleSectionComplete]);

    const tryExample = useCallback(() => {
        const exampleQuestion = "Erstelle eine Mindmap zum Thema 'Nachhaltiger Transport'";
        const tools = "Brainstorming"; // The brainstorm tool
        let url = `#/chat?q=${encodeURIComponent(exampleQuestion)}`;
        url += `&tools=${encodeURIComponent(tools)}`;
        window.location.href = url;
    }, []);

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.brainstorm.tips.specific.title", "Seien Sie spezifisch:"),
            description: t(
                "tutorials.brainstorm.tips.specific.description",
                "Je präziser Ihr Thema, desto gezielter und relevanter werden die generierten Ideen."
            )
        },
        {
            title: t("tutorials.brainstorm.tips.context.title", "Kontext hinzufügen:"),
            description: t(
                "tutorials.brainstorm.tips.context.description",
                "Fügen Sie zusätzlichen Kontext hinzu, um die KI bei der Ideengenerierung zu unterstützen."
            )
        },
        {
            title: t("tutorials.brainstorm.tips.iterate.title", "Iterativ arbeiten:"),
            description: t(
                "tutorials.brainstorm.tips.iterate.description",
                "Nutzen Sie die Ergebnisse als Ausgangspunkt und verfeinern Sie Ihre Anfragen schrittweise."
            )
        }
    ];

    return (
        <div>
            {/* Tutorial Progress - Sticky */}
            <TutorialProgress
                currentStep={currentStep}
                totalSteps={tutorialSections.length}
                completedSections={completedSections}
                onSectionComplete={handleSectionComplete}
                sections={tutorialSections}
                titleTranslationKey="tutorials.brainstorm.progress.title"
                defaultTitle="Brainstorming-Tutorial Fortschritt"
                isSticky={true}
                stickyOffset={50}
                showPercentage={true}
                showStats={true}
                compact={true}
                onPreviousTutorial={onPreviousTutorial}
                onNextTutorial={onNextTutorial}
                onBackToTop={onBackToTop}
                currentTutorialId={currentTutorialId}
                allTutorials={allTutorials}
            />

            {/* Wrap BaseTutorial sections with IDs for progress tracking */}
            <div id="section-intro">
                <BaseTutorial
                    title={t("tutorials.brainstorm.intro.title", "Was ist das Brainstorming-Tool?")}
                    titleIcon={<BrainCircuit24Regular />}
                    description={t(
                        "tutorials.brainstorm.intro.description",
                        "Das Brainstorming-Tool generiert strukturierte Mindmaps zu jedem Thema. Es nutzt KI, um kreative Ideen zu sammeln, zu organisieren und als interaktive Mindmap darzustellen."
                    )}
                    example={{
                        title: t("tutorials.brainstorm.example.title", "Brainstorming Beispiel"),
                        description: t("tutorials.brainstorm.example.description", ""),
                        component: (
                            <div id="section-example">
                                {showExample ? (
                                    <div>
                                        <div className={styles.exampleContainer}>
                                            <AnswerList
                                                answers={createBrainstormWorkflowExample()}
                                                regularAssistantMsg={answer => <Answer answer={answer.response} setQuestion={() => {}} />}
                                                onRollbackMessage={() => {}}
                                                isLoading={false}
                                                error={null}
                                                makeApiRequest={() => {}}
                                                chatMessageStreamEnd={chatMessageStreamEnd}
                                                lastQuestionRef={lastQuestionRef}
                                            />
                                        </div>
                                        <div className={styles.buttonsContainer}>
                                            <button onClick={toggleExample} className={`${styles.button} ${styles.hideButton}`}>
                                                {t("tutorials.buttons.hide_example")}
                                            </button>
                                            <button onClick={tryExample} className={`${styles.button} ${styles.tryButton}`}>
                                                <Send24Regular className={styles.tryButtonIcon} />
                                                {t("tutorials.buttons.try_example")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.buttonsContainerSingle}>
                                        <button onClick={toggleExample} className={`${styles.button} ${styles.showButton}`}>
                                            {t("tutorials.buttons.show_example")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    }}
                    tips={tips}
                />
            </div>

            {/* Tips section marker for progress tracking */}
            <div id="section-tips" style={{ position: "absolute", bottom: 0, height: "1px" }}></div>
        </div>
    );
};
