import { useState, useCallback, useRef } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { TextBulletListSquare24Regular, Send24Regular, Target24Regular } from "@fluentui/react-icons";

import { BaseTutorial, TutorialTip } from "./BaseTutorial";
import TutorialProgress from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import { AnswerList } from "../../../components/AnswerList/AnswerList";
import { Answer } from "../../../components/Answer";
import { ChatMessage } from "../../chat/Chat";
import styles from "./SimplifyTutorial.module.css";
import { TutorialNavigationProps, TutorialSection } from "./TutorialTypes";

// Create a realistic simplify workflow example
const createSimplifyWorkflowExample = (): ChatMessage[] => {
    return [
        {
            user: "Vereinfache diesen Text in Leichte Sprache: 'Die Digitalisierung verändert fundamentale Strukturen in Organisationen und erfordert eine umfassende strategische Neuausrichtung der Geschäftsprozesse.'",
            response: {
                answer: `
\`\`\`MUCGPTSimplify
Die Computer-Technik verändert die Firmen sehr stark.
Die Firmen müssen neue Pläne machen.
Sie müssen ihre Arbeit anders machen.

Die Firmen brauchen neue Computer-Programme.
Sie müssen auch anders zusammen-arbeiten.
Das ist wichtig.
Sonst können andere Firmen besser werden.
\`\`\`MUCGPTSimplify
`,
                activeTools: [
                    {
                        name: "simplify",
                        message: "Vereinfache Text in Leichte Sprache A2-Standard",
                        state: "ENDED" as const,
                        timestamp: Date.now() - 4000
                    }
                ]
            }
        }
    ];
};

export const SimplifyTutorial = ({ onPreviousTutorial, onNextTutorial, onBackToTop, currentTutorialId, allTutorials }: TutorialNavigationProps = {}) => {
    const { t } = useTranslation();
    const [showExample, setShowExample] = useState(false);
    const chatMessageStreamEnd = useRef<HTMLDivElement>(null);
    const lastQuestionRef = useRef<string>("");

    // Tutorial sections for progress tracking
    const tutorialSections = React.useMemo<TutorialSection[]>(
        () => [
            { id: "intro", translationKey: "tutorials.simplify.sections.titles.intro", defaultLabel: "Einführung" },
            { id: "example", translationKey: "tutorials.simplify.sections.titles.example", defaultLabel: "Beispiel" },
            { id: "tips", translationKey: "tutorials.simplify.sections.titles.tips", defaultLabel: "Tipps" }
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
        const exampleQuestion =
            "Vereinfache diesen Text in Leichte Sprache: 'Die Digitalisierung verändert fundamentale Strukturen in Organisationen und erfordert eine umfassende strategische Neuausrichtung der Geschäftsprozesse.'";
        const tools = "Vereinfachen"; // The simplify tool
        let url = `#/chat?q=${encodeURIComponent(exampleQuestion)}`;
        url += `&tools=${encodeURIComponent(tools)}`;
        window.location.href = url;
    }, []);

    const tips: TutorialTip[] = [];
    return (
        <div>
            {/* Tutorial Progress - Sticky */}
            <TutorialProgress
                currentStep={currentStep}
                totalSteps={tutorialSections.length}
                completedSections={completedSections}
                onSectionComplete={handleSectionComplete}
                sections={tutorialSections}
                titleTranslationKey="tutorials.simplify.progress.title"
                defaultTitle="Vereinfachen-Tutorial Fortschritt"
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
                title={t("tutorials.simplify.intro.title", "Was ist das Text-Vereinfachungs-Tool?")}
                titleIcon={<TextBulletListSquare24Regular className="sectionIcon" />}
                description={t(
                    "tutorials.simplify.intro.description",
                    "Das Text-Vereinfachungs-Tool übersetzt komplexe Texte in Leichte Sprache nach A2-Standard. Es nutzt KI mit automatischer Qualitätsprüfung, um Texte verständlicher und barrierefreier zu machen."
                )}
                example={{
                    title: t("tutorials.simplify.example.title", "Text Vereinfachung Beispiel"),
                    description: t("tutorials.simplify.example.description", ""),
                    component: (
                        <div>
                            {/* Introduction Section */}
                            <div id="section-intro" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <TextBulletListSquare24Regular className={styles.sectionIcon} />
                                    <span className={styles.sectionTitleText}>
                                        {t("tutorials.simplify.sections.intro.title", "Was ist das Text-Vereinfachungs-Tool?")}
                                    </span>
                                </div>
                                <p className={styles.sectionText}>
                                    {t(
                                        "tutorials.simplify.sections.intro.description",
                                        "Das Text-Vereinfachungs-Tool übersetzt komplexe Texte in Leichte Sprache nach A2-Standard. Es nutzt KI mit automatischer Qualitätsprüfung, um Texte verständlicher und barrierefreier zu machen."
                                    )}
                                </p>
                            </div>

                            {/* Example Section */}
                            <div id="section-example" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Send24Regular className={styles.sectionIcon} />
                                    <span className={styles.sectionTitleText}>
                                        {t("tutorials.simplify.sections.example.title", "Text Vereinfachung Beispiel")}
                                    </span>
                                </div>

                                {showExample ? (
                                    <div>
                                        <div className={styles.exampleContainer}>
                                            <AnswerList
                                                answers={createSimplifyWorkflowExample()}
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
                                    <span className={styles.sectionTitleText}>{t("tutorials.simplify.sections.tips.title", "Tipps")}</span>
                                </div>

                                <div className={styles.tipsContainer}>
                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.simplify.tips.length.title", "Textlänge beachten:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.simplify.tips.length.description",
                                                "Sehr lange Texte in kleinere Abschnitte aufteilen für bessere Ergebnisse."
                                            )}
                                        </p>
                                    </div>

                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.simplify.tips.review.title", "Ergebnis prüfen:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.simplify.tips.review.description",
                                                "Lesen Sie den vereinfachten Text durch und prüfen Sie, ob alle wichtigen Informationen enthalten sind."
                                            )}
                                        </p>
                                    </div>

                                    <div className={styles.tipItem}>
                                        <strong>{t("tutorials.simplify.tips.target.title", "Zielgruppe denken:")}</strong>
                                        <p>
                                            {t(
                                                "tutorials.simplify.tips.target.description",
                                                "Leichte Sprache hilft Menschen mit Lernschwierigkeiten, Sprachlernenden und allen, die einfache Texte bevorzugen."
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
