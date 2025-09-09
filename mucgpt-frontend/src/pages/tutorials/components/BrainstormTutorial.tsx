import { useState, useCallback, useRef } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Play24Regular, BrainCircuit24Regular, Target24Regular, DocumentBulletList24Regular, Send24Regular } from "@fluentui/react-icons";
import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
import TutorialProgress, { TutorialSection } from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import { AnswerList } from "../../../components/AnswerList/AnswerList";
import { Answer } from "../../../components/Answer";
import { ChatMessage } from "../../chat/Chat";
import styles from "./BrainstormTutorial.module.css";

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

export const BrainstormTutorial = () => {
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

    const features: TutorialFeature[] = [
        {
            icon: <BrainCircuit24Regular />,
            title: t("tutorials.brainstorm.features.ai.title", "KI-gestütztes Brainstorming"),
            description: t(
                "tutorials.brainstorm.features.ai.description",
                "Nutzt fortschrittliche KI-Modelle, um kreative und strukturierte Ideen zu generieren."
            )
        },
        {
            icon: <Target24Regular />,
            title: t("tutorials.brainstorm.features.structure.title", "Strukturierte Mindmaps"),
            description: t(
                "tutorials.brainstorm.features.structure.description",
                "Organisiert Ideen hierarchisch mit Haupt- und Unterthemen für bessere Übersicht."
            )
        },
        {
            icon: <Play24Regular />,
            title: t("tutorials.brainstorm.features.interactive.title", "Interaktive Darstellung"),
            description: t("tutorials.brainstorm.features.interactive.description", "Expandierbare und navigierbare Mindmap-Knoten für intuitive Exploration.")
        },
        {
            icon: <DocumentBulletList24Regular />,
            title: t("tutorials.brainstorm.features.export.title", "Export-Funktionen"),
            description: t("tutorials.brainstorm.features.export.description", "Mindmaps als Markdown, PDF oder Bild exportieren.")
        }
    ];

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.brainstorm.tips.specific.title", "Seien Sie spezifisch"),
            description: t(
                "tutorials.brainstorm.tips.specific.description",
                "Je präziser Ihr Thema, desto gezielter und relevanter werden die generierten Ideen."
            ),
            type: "success"
        },
        {
            title: t("tutorials.brainstorm.tips.context.title", "Kontext hinzufügen"),
            description: t(
                "tutorials.brainstorm.tips.context.description",
                "Fügen Sie zusätzlichen Kontext hinzu, um die KI bei der Ideengenerierung zu unterstützen."
            ),
            type: "info"
        },
        {
            title: t("tutorials.brainstorm.tips.iterate.title", "Iterativ arbeiten"),
            description: t(
                "tutorials.brainstorm.tips.iterate.description",
                "Nutzen Sie die Ergebnisse als Ausgangspunkt und verfeinern Sie Ihre Anfragen schrittweise."
            ),
            type: "info"
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
            />

            <BaseTutorial
                title={t("tutorials.brainstorm.intro.title", "Was ist das Brainstorming-Tool?")}
                titleIcon={<BrainCircuit24Regular className="sectionIcon" />}
                description={t(
                    "tutorials.brainstorm.intro.description",
                    "Das Brainstorming-Tool generiert strukturierte Mindmaps zu jedem Thema. Es nutzt KI, um kreative Ideen zu sammeln, zu organisieren und als interaktive Mindmap darzustellen."
                )}
                features={features}
                example={{
                    title: t("tutorials.brainstorm.example.title", "Brainstorming Beispiel"),
                    description: t("tutorials.brainstorm.example.description", ""),
                    component: (
                        <div>
                            {/* Introduction Section */}
                            <div id="section-intro" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <BrainCircuit24Regular className={styles.sectionIcon} />
                                    <span className={styles.sectionTitleText}>
                                        {t("tutorials.brainstorm.sections.intro.title", "Was ist das Brainstorming-Tool?")}
                                    </span>
                                </div>
                                <p className={styles.sectionText}>
                                    {t(
                                        "tutorials.brainstorm.sections.intro.description",
                                        "Das Brainstorming-Tool generiert strukturierte Mindmaps zu jedem Thema. Es nutzt KI, um kreative Ideen zu sammeln, zu organisieren und als interaktive Mindmap darzustellen."
                                    )}
                                </p>
                            </div>

                            {/* Example Section */}
                            <div id="section-example" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Send24Regular className={styles.sectionIcon} />
                                    <span className={styles.sectionTitleText}>
                                        {t("tutorials.brainstorm.sections.example.title", "Brainstorming Beispiel")}
                                    </span>
                                </div>

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

                            {/* Tips Section */}
                            <div id="section-tips" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Target24Regular className={styles.sectionIcon} />
                                    <span className={styles.sectionTitleText}>{t("tutorials.brainstorm.sections.tips.title", "Tipps")}</span>
                                </div>

                                <div className={styles.tipsContainer}>
                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.brainstorm.tips.specific.title", "Seien Sie spezifisch:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.brainstorm.tips.specific.description",
                                                "Je präziser Ihr Thema, desto gezielter und relevanter werden die generierten Ideen."
                                            )}
                                        </p>
                                    </div>

                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.brainstorm.tips.context.title", "Kontext hinzufügen:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.brainstorm.tips.context.description",
                                                "Fügen Sie zusätzlichen Kontext hinzu, um die KI bei der Ideengenerierung zu unterstützen."
                                            )}
                                        </p>
                                    </div>

                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.brainstorm.tips.iterate.title", "Iterativ arbeiten:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.brainstorm.tips.iterate.description",
                                                "Nutzen Sie die Ergebnisse als Ausgangspunkt und verfeinern Sie Ihre Anfragen schrittweise."
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }}
                tips={tips}
            />
        </div>
    );
};
