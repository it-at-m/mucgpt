import { useState, useCallback, useContext, useEffect } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Toolbox24Regular, CheckmarkCircle24Regular, BrainCircuit24Regular, TextBulletListSquare24Regular } from "@fluentui/react-icons";
import { Button, Text } from "@fluentui/react-components";
import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
import TutorialProgress, { TutorialSection } from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import { QuestionInput } from "../../../components/QuestionInput/QuestionInput";
import { ToolListResponse } from "../../../api/models";
import ToolStatusDisplay from "../../../components/ToolStatusDisplay/ToolStatusDisplay";
import { ToolStatus, ToolStreamState } from "../../../utils/ToolStreamHandler";
import { LanguageContext } from "../../../components/LanguageSelector/LanguageContextProvider";
import { getTools } from "../../../api/core-client";
import { mapContextToBackendLang } from "../../../utils/language-utils";
import styles from "./ToolsTutorial.module.css";

// Create a tutorial-specific implementation using the real QuestionInput
const TutorialQuestionInput = ({ selectedTools, setSelectedTools }: { selectedTools: string[]; setSelectedTools: (tools: string[]) => void }) => {
    const [question, setQuestion] = useState("Welche Ideen gibt es für nachhaltige Mobilität?");
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const [tools, setTools] = useState<ToolListResponse>({ tools: [] });
    const { t } = useTranslation();
    const { language } = useContext(LanguageContext);

    // Fetch tools in the current language
    useEffect(() => {
        const fetchTools = async () => {
            try {
                const backendLang = mapContextToBackendLang(language);
                const result = await getTools(backendLang);
                setTools(result);
            } catch (error) {
                console.error("Failed to fetch tools for tutorial:", error);
                // Fallback to mock tools if API fails
                setTools({
                    tools: [
                        {
                            id: "Brainstorming",
                            name: "Brainstorming",
                            description: "Generates a detailed mind map for a given topic in markdown format."
                        },
                        {
                            id: "Vereinfachen",
                            name: "Vereinfachen",
                            description: "Simplifies complex German text to A2 level using Easy Language principles."
                        }
                    ]
                });
            }
        };
        fetchTools();
    }, [language]);

    const simulateToolExecution = useCallback(
        (toolNames: string[]) => {
            const now = Date.now();

            // Clear any existing statuses
            setToolStatuses([]);

            // Start all tools
            const startingStatuses: ToolStatus[] = toolNames.map(name => {
                const tool = tools.tools.find(t => t.id === name);
                const toolDisplayName = tool?.name || name;

                return {
                    name: toolDisplayName,
                    state: ToolStreamState.STARTED,
                    timestamp: now,
                    message:
                        name === "Brainstorming"
                            ? t("tutorials.tools.simulation.brainstorm_start", "Erstelle strukturierte Mindmap...")
                            : t("tutorials.tools.simulation.simplify_start", "Vereinfache Text in Leichte Sprache...")
                };
            });

            setToolStatuses(startingStatuses);

            // Simulate completion after 2-3 seconds for each tool
            toolNames.forEach((toolName, index) => {
                setTimeout(
                    () => {
                        setToolStatuses(current => {
                            const tool = tools.tools.find(t => t.id === toolName);
                            const toolDisplayName = tool?.name || toolName;

                            // Remove the started status and add completed status
                            const filtered = current.filter(status => !(status.name === toolDisplayName && status.state === ToolStreamState.STARTED));
                            return [
                                ...filtered,
                                {
                                    name: toolDisplayName,
                                    state: ToolStreamState.ENDED,
                                    timestamp: Date.now(),
                                    message:
                                        toolName === "Brainstorming"
                                            ? t("tutorials.tools.simulation.brainstorm_end", "Mindmap erfolgreich erstellt")
                                            : t("tutorials.tools.simulation.simplify_end", "Text erfolgreich vereinfacht")
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
        },
        [tools, t]
    );

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
                question={question}
                setQuestion={setQuestion}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={tools}
            />
            <ToolStatusDisplay activeTools={toolStatuses} />
        </>
    );
};

export const ToolsTutorial = ({
    onNavigateToTutorial,
    onPreviousTutorial,
    onNextTutorial,
    onBackToTop,
    currentTutorialId,
    allTutorials
}: {
    onNavigateToTutorial?: (tutorialId: string) => void;
    onPreviousTutorial?: () => void;
    onNextTutorial?: () => void;
    onBackToTop?: () => void;
    currentTutorialId?: string;
    allTutorials?: Array<{ id: string; title: string }>;
} = {}) => {
    const { t } = useTranslation();
    const [showExample, setShowExample] = useState(false);
    const [selectedTools, setSelectedTools] = useState<string[]>([]);

    // Tutorial sections for progress tracking
    const tutorialSections = React.useMemo<TutorialSection[]>(
        () => [
            { id: "intro", translationKey: "tutorials.tools.sections.titles.intro", defaultLabel: "Einführung" },
            { id: "selection", translationKey: "tutorials.tools.sections.titles.selection", defaultLabel: "Tool-Auswahl" },
            { id: "usage", translationKey: "tutorials.tools.sections.titles.usage", defaultLabel: "Verwendung" }
        ],
        []
    );

    // Use the custom hook for progress tracking
    const { currentStep, completedSections, handleSectionComplete } = useTutorialProgress({ sections: tutorialSections });

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
            title: t("tutorials.tools.tips.select_relevant.title", "Wählen Sie relevante Tools:"),
            description: t(
                "tutorials.tools.tips.select_relevant.description",
                "Wählen Sie nur die Tools aus, die Sie tatsächlich benötigen, um optimale Ergebnisse zu erzielen."
            )
        },
        {
            title: t("tutorials.tools.tips.combine_wisely.title", "Kombinieren Sie strategisch:"),
            description: t(
                "tutorials.tools.tips.combine_wisely.description",
                "Kombinieren Sie Tools strategisch für komplexe Aufgaben und maximieren Sie so ihre Effizienz."
            )
        },
        {
            title: t("tutorials.tools.tips.clear_instructions.title", "Klare Anweisungen geben:"),
            description: t(
                "tutorials.tools.tips.clear_instructions.description",
                "Geben Sie klare Anweisungen, wenn Sie mehrere Tools verwenden, damit die KI optimal arbeiten kann."
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
                titleTranslationKey="tutorials.tools.progress.title"
                defaultTitle="Werkzeuge-Tutorial Fortschritt"
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
                    component: (
                        <div>
                            {/* Introduction Section */}
                            <div id="section-intro" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Toolbox24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.tools.sections.intro.title", "Was sind KI-Werkzeuge?")}
                                    </Text>
                                </div>
                                <Text as="p">
                                    {t(
                                        "tutorials.tools.sections.intro.description",
                                        "KI-Werkzeuge sind spezialisierte Funktionen, die erweiterte Fähigkeiten zu Sprachmodellen hinzufügen. Sie ermöglichen es der KI, spezifische Aufgaben wie Web-Recherche, Brainstorming oder Textvereinfachung durchzuführen."
                                    )}
                                </Text>
                                <div className={styles.highlightBox}>
                                    <Text as="p" weight="semibold">
                                        {t("tutorials.tools.sections.intro.key_point", "Wichtig:")}
                                    </Text>
                                    <Text as="p">
                                        {t(
                                            "tutorials.tools.sections.intro.key_explanation",
                                            "Tools erweitern die Grundfähigkeiten der KI und ermöglichen es, aktuelle Informationen abzurufen oder komplexe Berechnungen durchzuführen."
                                        )}
                                    </Text>
                                </div>
                            </div>

                            {/* Tool Selection Section */}
                            <div id="section-selection" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <CheckmarkCircle24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.tools.sections.selection.title", "Werkzeuge auswählen")}
                                    </Text>
                                </div>
                                <Text as="p">
                                    {t(
                                        "tutorials.tools.sections.selection.description",
                                        "Die Auswahl der richtigen Werkzeuge ist entscheidend für optimale Ergebnisse. Jedes Tool ist für spezifische Aufgaben optimiert."
                                    )}
                                </Text>

                                <div className={styles.conceptGrid}>
                                    <div className={styles.conceptCard}>
                                        <BrainCircuit24Regular className={styles.conceptIcon} />
                                        <Text as="h4" size={300} weight="semibold">
                                            {t("tutorials.tools.sections.selection.brainstorming.title", "Brainstorming")}
                                        </Text>
                                        <Text as="p" size={200}>
                                            {t(
                                                "tutorials.tools.sections.selection.brainstorming.description",
                                                "Erstellt strukturierte Mindmaps zu jedem Thema"
                                            )}
                                        </Text>
                                    </div>

                                    <div className={styles.conceptCard}>
                                        <TextBulletListSquare24Regular className={styles.conceptIcon} />
                                        <Text as="h4" size={300} weight="semibold">
                                            {t("tutorials.tools.sections.selection.simplify.title", "Vereinfachen")}
                                        </Text>
                                        <Text as="p" size={200}>
                                            {t("tutorials.tools.sections.selection.simplify.description", "Übersetzt komplexe Texte in Leichte Sprache")}
                                        </Text>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Section */}
                            <div id="section-usage" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Toolbox24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.tools.sections.usage.title", "Werkzeuge verwenden")}
                                    </Text>
                                </div>
                                <Text as="p">
                                    {t(
                                        "tutorials.tools.sections.usage.description",
                                        "Probieren Sie die Werkzeug-Auswahl aus. Die gewählten Tools werden während der Antwortgenerierung automatisch aktiviert."
                                    )}
                                </Text>

                                {showExample ? (
                                    <div className={styles.tutorialContainer}>
                                        <TutorialQuestionInput selectedTools={selectedTools} setSelectedTools={setSelectedTools} />
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
                                            {showExample
                                                ? t("tutorials.tools.buttons.hide_example", "Beispiel ausblenden")
                                                : t("tutorials.tools.buttons.show_example", "Beispiel anzeigen")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }}
                tips={tips}
            />
        </div>
    );
};
