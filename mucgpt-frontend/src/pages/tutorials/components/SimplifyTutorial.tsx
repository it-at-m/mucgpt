import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TextBulletListSquare24Regular, CheckmarkCircle24Regular, Edit24Regular, ArrowDownload24Regular, Send24Regular } from "@fluentui/react-icons";

import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
import { AnswerList } from "../../../components/AnswerList/AnswerList";
import { Answer } from "../../../components/Answer";
import { ChatMessage } from "../../chat/Chat";
import styles from "./SimplifyTutorial.module.css";

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

export const SimplifyTutorial = () => {
    const { t } = useTranslation();
    const [showExample, setShowExample] = useState(false);
    const chatMessageStreamEnd = useRef<HTMLDivElement>(null);
    const lastQuestionRef = useRef<string>("");

    const toggleExample = useCallback(() => {
        setShowExample(!showExample);
    }, [showExample]);

    const tryExample = useCallback(() => {
        const exampleQuestion =
            "Vereinfache diesen Text in Leichte Sprache: 'Die Digitalisierung verändert fundamentale Strukturen in Organisationen und erfordert eine umfassende strategische Neuausrichtung der Geschäftsprozesse.'";
        const tools = "simplify"; // The simplify tool
        let url = `#/chat?q=${encodeURIComponent(exampleQuestion)}`;
        url += `&tools=${encodeURIComponent(tools)}`;
        window.location.href = url;
    }, []);

    const features: TutorialFeature[] = [
        {
            icon: <TextBulletListSquare24Regular />,
            title: t("tutorials.simplify.features.easy.title", "Leichte Sprache A2"),
            description: t("tutorials.simplify.features.easy.description", "Wandelt komplexe Texte in verständliche Leichte Sprache nach A2-Standard um.")
        },
        {
            icon: <Edit24Regular />,
            title: t("tutorials.simplify.features.reflective.title", "Reflektive Verbesserung"),
            description: t("tutorials.simplify.features.reflective.description", "Automatische Qualitätsprüfung und iterative Verbesserung der Vereinfachung.")
        },
        {
            icon: <CheckmarkCircle24Regular />,
            title: t("tutorials.simplify.features.rules.title", "Regelkonform"),
            description: t(
                "tutorials.simplify.features.rules.description",
                "Befolgt alle Regeln für Leichte Sprache: kurze Sätze, einfache Wörter, klare Struktur."
            )
        },
        {
            icon: <ArrowDownload24Regular />,
            title: t("tutorials.simplify.features.download.title", "Download-Funktion"),
            description: t("tutorials.simplify.features.download.description", "Vereinfachte Texte als Textdatei herunterladen für weitere Verwendung.")
        }
    ];

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.simplify.tips.length.title", "Textlänge beachten"),
            description: t("tutorials.simplify.tips.length.description", "Sehr lange Texte in kleinere Abschnitte aufteilen für bessere Ergebnisse."),
            type: "info"
        },
        {
            title: t("tutorials.simplify.tips.review.title", "Ergebnis prüfen"),
            description: t(
                "tutorials.simplify.tips.review.description",
                "Lesen Sie den vereinfachten Text durch und prüfen Sie, ob alle wichtigen Informationen enthalten sind."
            ),
            type: "info"
        },
        {
            title: t("tutorials.simplify.tips.target.title", "Zielgruppe denken"),
            description: t(
                "tutorials.simplify.tips.target.description",
                "Leichte Sprache hilft Menschen mit Lernschwierigkeiten, Sprachlernenden und allen, die einfache Texte bevorzugen."
            ),
            type: "success"
        }
    ];
    return (
        <BaseTutorial
            title={t("tutorials.simplify.intro.title", "Was ist das Text-Vereinfachungs-Tool?")}
            titleIcon={<TextBulletListSquare24Regular className="sectionIcon" />}
            description={t(
                "tutorials.simplify.intro.description",
                "Das Text-Vereinfachungs-Tool übersetzt komplexe Texte in Leichte Sprache nach A2-Standard. Es nutzt KI mit automatischer Qualitätsprüfung, um Texte verständlicher und barrierefreier zu machen."
            )}
            features={features}
            example={{
                title: t("tutorials.simplify.example.title", "Text Vereinfachung Beispiel"),
                description: t("tutorials.simplify.example.description", ""),
                component: showExample ? (
                    <div>
                        <div className={styles.exampleContainer}>
                            <AnswerList
                                answers={createSimplifyWorkflowExample()}
                                regularBotMsg={answer => <Answer answer={answer.response} setQuestion={() => {}} />}
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
