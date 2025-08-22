import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Play24Regular, BrainCircuit24Regular, Target24Regular, DocumentBulletList24Regular, Send24Regular } from "@fluentui/react-icons";
import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
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

    const toggleExample = useCallback(() => {
        setShowExample(!showExample);
    }, [showExample]);

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
                component: showExample ? (
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
                )
            }}
            tips={tips}
        />
    );
};
