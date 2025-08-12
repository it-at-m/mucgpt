import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Toolbox24Regular, CheckmarkCircle24Regular, BrainCircuit24Regular, TextBulletListSquare24Regular } from "@fluentui/react-icons";
import { Button, Text } from "@fluentui/react-components";
import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
import { QuestionInput } from "../../../components/QuestionInput/QuestionInput";
import { ToolListResponse } from "../../../api/models";
import ToolStatusDisplay from "../../../components/ToolStatusDisplay/ToolStatusDisplay";
import { ToolStatus, ToolStreamState } from "../../../utils/ToolStreamHandler";
import styles from "./ToolsTutorial.module.css";

// Create a tutorial-specific implementation using the real QuestionInput
const TutorialQuestionInput = ({ selectedTools, setSelectedTools }: { selectedTools: string[]; setSelectedTools: (tools: string[]) => void }) => {
    const [question, setQuestion] = useState("Welche Ideen gibt es für nachhaltige Mobilität?");
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const { t } = useTranslation();

    // Create mock tools data structure
    const mockTools: ToolListResponse = {
        tools: [
            {
                name: "Brainstorming",
                description:
                    "Generates a detailed mind map for a given topic in markdown format.\nThe output uses headings for main ideas and subheadings for related subtopics,\nstructured as a markdown code block. This helps visualize and organize concepts,\nsubtopics, and relationships for the specified topic."
            },
            {
                name: "Vereinfachen",
                description:
                    "Simplifies complex German text to A2 level using Leichte Sprache (Easy Language) principles.\n\nThis tool transforms difficult texts into simple, accessible language following strict German accessibility standards.\nIt uses short sentences (max 15 words), simple vocabulary, active voice, and clear structure with line breaks.\n\nIMPORTANT: Always pass the COMPLETE text that needs to be simplified in a single tool call.\nDo NOT split long texts into multiple parts - the tool is designed to handle entire documents at once\nand will maintain context and coherence across the full text when simplifying."
            }
        ]
    };

    const simulateToolExecution = useCallback((toolNames: string[]) => {
        const now = Date.now();

        // Clear any existing statuses
        setToolStatuses([]);

        // Start all tools
        const startingStatuses: ToolStatus[] = toolNames.map(name => ({
            name,
            state: ToolStreamState.STARTED,
            timestamp: now,
            message: name === "Brainstorming" ? "Erstelle strukturierte Mindmap..." : "Vereinfache Text in Leichte Sprache..."
        }));

        setToolStatuses(startingStatuses);

        // Simulate completion after 2-3 seconds for each tool
        toolNames.forEach((toolName, index) => {
            setTimeout(
                () => {
                    setToolStatuses(current => {
                        // Remove the started status and add completed status
                        const filtered = current.filter(status => !(status.name === toolName && status.state === ToolStreamState.STARTED));
                        return [
                            ...filtered,
                            {
                                name: toolName,
                                state: ToolStreamState.ENDED,
                                timestamp: Date.now(),
                                message: toolName === "Brainstorming" ? "Mindmap erfolgreich erstellt" : "Text erfolgreich vereinfacht"
                            }
                        ];
                    });
                },
                2000 + index * 500
            ); // Stagger completion times
        });

        // Clear all statuses after 6 seconds
        setTimeout(() => {
            setToolStatuses([]);
        }, 6000);
    }, []);

    const handleSend = useCallback(() => {
        // This is just for demo - don't actually send
        console.log("Demo: Would send question with tools:", selectedTools);

        // Simulate tool execution if tools are selected
        if (selectedTools.length > 0) {
            simulateToolExecution(selectedTools);
        }
    }, [selectedTools, simulateToolExecution]);

    return (
        <>
            <QuestionInput
                onSend={handleSend}
                disabled={false}
                placeholder={t("components.questioninput.placeholder", "Stellen Sie Ihre Frage...")}
                clearOnSend={false}
                tokens_used={15}
                question={question}
                setQuestion={setQuestion}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={mockTools}
            />
            <ToolStatusDisplay activeTools={toolStatuses} />
        </>
    );
};

export const ToolsTutorial = ({ onNavigateToTutorial }: { onNavigateToTutorial?: (tutorialId: string) => void }) => {
    const { t } = useTranslation();
    const [showExample, setShowExample] = useState(false);
    const [selectedTools, setSelectedTools] = useState<string[]>([]);

    const toggleExample = useCallback(() => {
        setShowExample(!showExample);
        // Reset selected tools when hiding example
        if (showExample) {
            setSelectedTools([]);
        }
    }, [showExample]);
    const renderToolSpecificContent = () => {
        if (!showExample) return null;

        // Show content for selected tools
        const toolContent = [];

        if (selectedTools.includes("Brainstorming")) {
            toolContent.push(
                <div key="brainstorming" className={`${styles.toolSpecificContent}`}>
                    <div className={styles.toolContentHeader}>
                        <BrainCircuit24Regular className={`${styles.toolIcon} ${styles.brainstormingIcon}`} />
                        <Text weight="semibold" size={400}>
                            Brainstorming-Tool gewählt!
                        </Text>
                    </div>
                    <Text size={300} className={styles.toolDescription}>
                        Das Brainstorming-Tool erstellt strukturierte Mindmaps zu jedem Thema. Möchten Sie mehr über die erweiterten Funktionen erfahren?
                    </Text>
                    <Button
                        appearance="primary"
                        size="small"
                        icon={<BrainCircuit24Regular />}
                        onClick={() => {
                            if (onNavigateToTutorial) {
                                onNavigateToTutorial("brainstorm");
                            } else {
                                // Fallback: navigate directly using window.location
                                window.location.hash = "#/tutorials/brainstorm";
                            }
                        }}
                    >
                        Zum Brainstorming-Tutorial
                    </Button>
                </div>
            );
        }

        if (selectedTools.includes("Vereinfachen")) {
            toolContent.push(
                <div key="simplify" className={`${styles.toolSpecificContent}`}>
                    <div className={styles.toolContentHeader}>
                        <TextBulletListSquare24Regular className={`${styles.toolIcon} ${styles.simplifyIcon}`} />
                        <Text weight="semibold" size={400}>
                            Vereinfachen-Tool gewählt!
                        </Text>
                    </div>
                    <Text size={300} className={styles.toolDescription}>
                        Das Vereinfachen-Tool übersetzt komplexe Texte in verständliche Leichte Sprache. Erfahren Sie mehr über die Anwendung und Best
                        Practices.
                    </Text>
                    <Button
                        appearance="primary"
                        size="small"
                        icon={<TextBulletListSquare24Regular />}
                        onClick={() => {
                            if (onNavigateToTutorial) {
                                onNavigateToTutorial("simplify");
                            } else {
                                // Fallback: navigate directly using window.location
                                window.location.hash = "#/tutorials/simplify";
                            }
                        }}
                    >
                        Zum Vereinfachen-Tutorial
                    </Button>
                </div>
            );
        }

        // Show basic instructions when tools are selected but no specific content
        if (toolContent.length === 0 && selectedTools.length > 0) {
            return (
                <div className={styles.instructionsContainer}>
                    <span className={styles.instructionsTitle}>💡 Tipp:</span>
                    <div className={styles.instructionsList}>
                        Die ausgewählten Tools sind bereit zur Verwendung. Stellen Sie Ihre Frage und senden Sie sie ab!
                    </div>
                </div>
            );
        }

        // Show basic instructions when no tools are selected
        if (selectedTools.length === 0) {
            return (
                <div className={styles.instructionsContainer}>
                    <span className={styles.instructionsTitle}>💡 Tipp:</span>
                    <div className={styles.instructionsList}>
                        Wählen Sie ein oder mehrere Tools aus dem Werkzeug-Menü aus, um zu sehen, wie sie funktionieren.
                    </div>
                </div>
            );
        }

        return toolContent.length > 0 ? <>{toolContent}</> : null;
    };

    const features: TutorialFeature[] = [
        {
            icon: <Toolbox24Regular />,
            title: t("tutorials.tools.features.selector.title", "Tool-Auswahl"),
            description: t(
                "tutorials.tools.features.selector.description",
                "Wählen Sie spezifische KI-Tools aus, die für Ihre Aufgabe am besten geeignet sind."
            )
        },
        {
            icon: <CheckmarkCircle24Regular />,
            title: t("tutorials.tools.features.efficiency.title", "Effiziente Arbeitsweise"),
            description: t(
                "tutorials.tools.features.efficiency.description",
                "KI Werkzeuge sind spezialisierte Funktionen, die bestimmte Aufgaben effizient erledigen, wie Web-Recherche, Code-Ausführung oder mathematische Berechnungen."
            )
        }
    ];

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.tools.tips.relevant.title", "Nur relevante Tools wählen"),
            description: t(
                "tutorials.tools.tips.relevant.description",
                "Wählen Sie nur die Tools aus, die Sie gerade wirklich benötigen. Zu viele Tools können die Antwort verlangsamen oder zu schlechten Ergebnissen führen."
            ),
            type: "warning"
        }
    ];

    return (
        <BaseTutorial
            title={t("tutorials.tools.intro.title", "Was sind KI-Werkzeuge?")}
            titleIcon={<Toolbox24Regular className="sectionIcon" />}
            description={t(
                "tutorials.tools.intro.description",
                "AI-Tools sind spezialisierte Funktionen, die Sie der KI hinzufügen können, um spezifische Aufgaben zu erledigen. Von Web-Recherche über mathematische Berechnungen bis hin zur Code-Ausführung - wählen Sie die Tools aus, die Sie für Ihre Aufgabe benötigen."
            )}
            features={features}
            example={{
                title: t("tutorials.tools.example.title", "So wählen Sie ein Tools aus:"),
                description: t("tutorials.tools.example.description", ""),
                component: showExample ? (
                    <div className={styles.tutorialContainer}>
                        {" "}
                        <TutorialQuestionInput selectedTools={selectedTools} setSelectedTools={setSelectedTools} />{" "}
                        <div className={styles.instructionsContainer}>
                            <span className={styles.instructionsTitle}>So funktioniert's:</span>
                            <div className={styles.instructionsList}>
                                1. Klicken Sie auf das Werkzeug-Symbol rechts unten
                                <br />
                                2. Wählen Sie "Brainstorming" und "Vereinfachen" aus
                                <br />
                                3. Die gewählten Tools erscheinen als farbige Badges
                                <br />
                                4. Stellen Sie Ihre Frage und senden Sie sie ab
                                <br />
                                5. Sie sehen dann Benachrichtigungen über den Fortschritt des Werkzeugs
                            </div>
                        </div>
                        {renderToolSpecificContent()}
                    </div>
                ) : (
                    <div className={styles.exampleToggleContainer}>
                        <button onClick={toggleExample} className={styles.exampleToggleButton}>
                            {showExample ? "Beispiel ausblenden" : "Live-Beispiel anzeigen"}
                        </button>
                    </div>
                )
            }}
            tips={tips}
        />
    );
};
