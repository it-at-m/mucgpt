import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@fluentui/react-components";
import {
    BrainCircuit24Regular,
    DataArea24Regular,
    Search24Regular,
    ChartMultiple24Regular,
    TextBulletListSquare24Regular,
    Code24Regular,
    BookInformation24Regular,
    LearningApp24Regular
} from "@fluentui/react-icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../../../components/CodeBlockRenderer/CodeBlockRenderer";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { BaseTutorial, TutorialTip } from "./BaseTutorial";
import TutorialProgress, { TutorialSection } from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import styles from "./AIBasicsTutorial.module.css";

interface TutorialNavigationProps {
    onPreviousTutorial?: () => void;
    onNextTutorial?: () => void;
    onBackToTop?: () => void;
    currentTutorialId?: string;
    allTutorials?: Array<{ id: string; title: string }>;
}

const DATA_MERMAID = `mindmap
  root((LLM's\n haben Zugriff auf folgende Informationen))
    Elernte Informationen aus dem Training
      Allgemeines Wissen, welches erlernt wird
        Fakten
        Konzepte
        Wie funktioniert Sprache
      Inhalte bis zum Trainingszeitpunkt
        Bücher
        Websites
        Wissenschaftliche Artikel
      Künstlich erzeugte Trainingsdaten
    Aktueller Kontext während der Benutzung
      Verlauf
        Aktuelle Eingaben
        Gesprächsverlauf
        Systemprompt
      Werkzeuge, die den Kontext befüllen
        z.B. Websuche
        Brainstorming
    `;

const TRAINING_MERMAID = `flowchart TD
    Data[("Trainingsdaten\n(Terabytes an Text)")] --> Clean["Datenbereinigung\nund Vorbereitung"]
    Clean --> Tokenize["Tokenisierung\nder Texte"]
    Tokenize --> Pretrain["Vortraining\n(Selbstüberwachtes Lernen)"]
    Pretrain --> Finetune["Feinabstimmung\n(Supervisiertes Lernen)"]
    Finetune --> RLHF["RLHF\n(Verstärkendes Lernen\naus Human Feedback)"]
    RLHF --> Deploy["Fertiges\nLLM-Modell"]

    classDef process fill:#22C55E,stroke:#166534,color:white;
    classDef data fill:#3B82F6,stroke:#1E40AF,color:white;
    class Data,Deploy data;
    class Clean,Tokenize,Pretrain,Finetune,RLHF process;`;

const ARCHITECTURE_MERMAID = `flowchart TD
    Input["📝 Eingabetext\n'Wie ist das Wetter heute?'"] --> Tokenize["🔤 Tokenisierung\n[Wie][ist][das][Wetter][heute][?]"]
    Tokenize --> Embedding["🔢 Embeddings\nWörter → Zahlen"]
    Embedding --> Attention["🔍 Self-Attention\nWelche Wörter sind wichtig?"]
    Attention --> FFN["⚙️ Feed-Forward\nMuster erkennen"]
    FFN --> Predict["🎯 Vorhersage\nNächstes Wort bestimmen"]
    Predict --> Output["💬 Ausgabe\n'Das Wetter ist heute...'"]

    classDef input fill:#8B5CF6,stroke:#4C1D95,color:white;
    classDef process fill:#10B981,stroke:#065F46,color:white;
    classDef output fill:#3B82F6,stroke:#1E3A8A,color:white;

    class Input input;
    class Tokenize,Embedding,Attention,FFN,Predict process;
    class Output output;`;

export const AIBasicsTutorial = ({ onPreviousTutorial, onNextTutorial, onBackToTop, currentTutorialId, allTutorials }: TutorialNavigationProps = {}) => {
    const { t } = useTranslation();

    // Custom sections for AI Basics tutorial - memoized to prevent recreation
    const tutorialSections = React.useMemo<TutorialSection[]>(
        () => [
            { id: "intro", translationKey: "tutorials.ai_basics.sections.titles.intro", defaultLabel: "Was sind Sprachmodelle" },
            { id: "training", translationKey: "tutorials.ai_basics.sections.titles.training", defaultLabel: "Training" },
            { id: "functionality", translationKey: "tutorials.ai_basics.sections.titles.functionality", defaultLabel: "Funktionsweise" },
            { id: "access", translationKey: "tutorials.ai_basics.sections.titles.access", defaultLabel: "Was weiß ein Sprachmodell?" },
            { id: "conclusion", translationKey: "tutorials.ai_basics.sections.titles.conclusion", defaultLabel: "Fazit & Ausblick" }
        ],
        []
    );

    // Use the custom hook for progress tracking
    const { currentStep, completedSections, handleSectionComplete } = useTutorialProgress({ sections: tutorialSections });

    // Function to render Mermaid diagrams with Markdown
    const renderMermaidDiagram = (mermaidCode: string) => {
        const markdownContent = "```mermaid\n" + mermaidCode + "\n```";
        return (
            <div className={styles.mermaidContainer}>
                <Markdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                    components={{
                        code: CodeBlockRenderer
                    }}
                >
                    {markdownContent}
                </Markdown>
            </div>
        );
    };

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
                titleTranslationKey="tutorials.ai_basics.progress.title"
                defaultTitle="KI-Grundlagen Fortschritt"
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
                title={t("tutorials.ai_basics.intro.title", "Grundlagen moderner KI-Systeme")}
                titleIcon={<BrainCircuit24Regular className="sectionIcon" />}
                description={t(
                    "tutorials.ai_basics.intro.description",
                    "Verstehen Sie, wie moderne KI-Systeme wie Large Language Models (LLMs) funktionieren und trainiert werden."
                )}
                example={{
                    title: t("tutorials.ai_basics.example.title", "Wie funktionieren Large Language Models?"),
                    description: t("tutorials.ai_basics.example.description", "Ein Überblick über die grundlegenden Konzepte und Funktionsweisen von LLMs."),
                    component: (
                        <div>
                            <div id="section-intro" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <BrainCircuit24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.ai_basics.sections.what_are_llms.title", "Was sind große Sprachmodelle?")}
                                    </Text>
                                </div>
                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.what_are_llms.description",
                                        "Große Sprachmodelle/Large Language Models (LLMs) sind KI-Systeme, die darauf trainiert wurden, menschliche Sprache zu verstehen und zu generieren. Sie funktionieren durch die Vorhersage des nächstwahrscheinlichen Wortes in einer Sequenz, basierend auf ihrem Training mit enormen Textmengen."
                                    )}
                                </Text>

                                <div className={styles.highlightBox}>
                                    <Text as="p" weight="semibold">
                                        {t("tutorials.ai_basics.sections.what_are_llms.key_point", "Kernprinzip:")}
                                    </Text>
                                    <Text as="p">
                                        {t(
                                            "tutorials.ai_basics.sections.what_are_llms.key_explanation",
                                            "LLMs lernen statistische Beziehungen zwischen Wörtern und Konzepten. Sie generieren Text, indem sie vorhersagen, welche Wörter am wahrscheinlichsten auf die vorherigen folgen."
                                        )}
                                    </Text>
                                </div>
                            </div>

                            {/* Phase tabs */}
                            <div id="section-training" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <LearningApp24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={600} weight="semibold" className={styles.phasesTitle}>
                                        {t("tutorials.ai_basics.sections.phases.title", "Training")}
                                    </Text>
                                </div>

                                <div className={styles.phaseContent}>
                                    {" "}
                                    <Text as="p" className={styles.phaseDescription}>
                                        {t(
                                            "tutorials.ai_basics.sections.training_phase.description",
                                            "Die Trainingsphase findet nur einmal statt, bevor ein LLM überhaupt genutzt werden kann. In dieser Phase 'lernt' das Modell, Sprache zu verstehen und zu generieren. Dies geschieht durch die Analyse enormer Mengen an Textdaten."
                                        )}
                                    </Text>
                                    {renderMermaidDiagram(TRAINING_MERMAID)}
                                    <Text as="p" size={200} className={styles.stepsTitle}>
                                        {t("tutorials.ai_basics.sections.training_phase.steps_title", "Der Trainingsprozess umfasst folgende Schritte:")}
                                    </Text>
                                    <div className={styles.timeline}>
                                        <div className={styles.timelineItem}>
                                            <div className={styles.timelineYear}>
                                                {t("tutorials.ai_basics.sections.training.step1.title", "1. Datensammlung")}
                                            </div>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.training.step1.description",
                                                    "Enorme Mengen an Text aus dem Internet, Büchern, Artikeln und anderen Quellen werden gesammelt. Diese Daten bilden den Grundstein für das Verständnis der Sprache."
                                                )}
                                            </Text>
                                        </div>

                                        <div className={styles.timelineItem}>
                                            <div className={styles.timelineYear}>
                                                {t("tutorials.ai_basics.sections.training.step2.title", "2. Vortraining")}
                                            </div>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.training.step2.description",
                                                    "Das Modell lernt, Wörter und Sätze vorherzusagen, indem es Teile des Textes abdeckt und versucht, diese zu rekonstruieren. Dies geschieht auf Millionen von Textbeispielen."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Beispiel:</strong> "Die Hauptstadt von Deutschland ist [MASK]."
                                                </Text>
                                                <Text size={200}>
                                                    <strong>Modell lernt:</strong> "Die Hauptstadt von Deutschland ist Berlin."
                                                </Text>
                                            </div>
                                        </div>

                                        <div className={styles.timelineItem}>
                                            <div className={styles.timelineYear}>
                                                {t("tutorials.ai_basics.sections.training.step3.title", "3. Feinabstimmung")}
                                            </div>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.training.step3.description",
                                                    "Das vortrainierte Modell wird mit spezifischeren Daten weiter trainiert, oft unter menschlicher Anleitung, um es für bestimmte Aufgaben zu optimieren und sicherzustellen, dass es nützliche und sichere Antworten gibt."
                                                )}
                                            </Text>
                                        </div>

                                        <div className={styles.timelineItem}>
                                            <div className={styles.timelineYear}>{t("tutorials.ai_basics.sections.training.step4.title", "4. RLHF")}</div>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.training.step4.description",
                                                    "Reinforcement Learning from Human Feedback (RLHF): Das Modell wird weiter trainiert, indem menschliches Feedback zu seinen Antworten einbezogen wird. Dies hilft dem Modell, hilfreichere, wahrheitsgetreuere und sicherere Antworten zu generieren."
                                                )}
                                            </Text>
                                        </div>
                                    </div>
                                    <div className={styles.keyConcept}>
                                        <BookInformation24Regular className={styles.keyConceptIcon} />
                                        <div>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.training_phase.key_concept", "Wichtig zu verstehen:")}
                                            </Text>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.training_phase.key_explanation",
                                                    "Die Trainingsphase ist extrem rechenintensiv und erfordert große Mengen an Ressourcen. Ein großes Modell wie GPT-4 kann mehrere Wochen auf Hunderten oder Tausenden von spezialisierten Grafikprozessoren (GPUs) trainiert werden und Millionen von Euro kosten."
                                                )}
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* How LLMs work - detailed explanation */}
                            <div id="section-functionality" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <DataArea24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.ai_basics.sections.how_it_works.title", "Funktionsweise")}
                                    </Text>
                                </div>
                                <Text as="p" className={styles.sectionIntro}>
                                    {t(
                                        "tutorials.ai_basics.sections.how_it_works.intro",
                                        "Um zu verstehen, wie ein LLM funktioniert, schauen wir uns Schritt für Schritt an, was passiert, wenn Sie eine Frage stellen. Stellen Sie sich vor, Sie fragen: 'Wie ist das Wetter heute?'"
                                    )}
                                </Text>

                                <div className={styles.stepByStepContainer}>
                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>1</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step1.title", "Eingabe wird zerlegt (Tokenisierung)")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step1.description",
                                                    "Ihr Text wird in kleine Teile zerlegt, die 'Tokens' genannt werden. Das können ganze Wörter oder Wortteile sein."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Beispiel:</strong>
                                                </Text>
                                                <div className={styles.tokenBreakdown}>
                                                    <span className={styles.originalText}>"Wie ist das Wetter heute?"</span>
                                                    <span className={styles.arrow}>→</span>
                                                    <div className={styles.tokenVisualization}>
                                                        <span className={styles.token}>"Wie"</span>
                                                        <span className={styles.token}>"ist"</span>
                                                        <span className={styles.token}>"das"</span>
                                                        <span className={styles.token}>"Wetter"</span>
                                                        <span className={styles.token}>"heute"</span>
                                                        <span className={styles.token}>"?"</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>2</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step2.title", "Wörter werden zu Zahlen (Embeddings)")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step2.description",
                                                    "Computer können nur mit Zahlen rechnen, nicht mit Wörtern. Deshalb wird jedes Token in eine Liste von Zahlen umgewandelt, die seine 'Bedeutung' repräsentiert."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Vereinfachtes Beispiel:</strong>
                                                </Text>
                                                <div className={styles.embeddingExample}>
                                                    <div className={styles.embeddingItem}>
                                                        <span className={styles.token}>"Wetter"</span>
                                                        <span className={styles.arrow}>→</span>
                                                        <span className={styles.numbers}>[0.2, -0.1, 0.8, 0.3, ...]</span>
                                                    </div>
                                                    <div className={styles.embeddingItem}>
                                                        <span className={styles.token}>"heute"</span>
                                                        <span className={styles.arrow}>→</span>
                                                        <span className={styles.numbers}>[0.1, 0.5, -0.2, 0.7, ...]</span>
                                                    </div>
                                                </div>
                                                <Text size={100} className={styles.noteText}>
                                                    {t("tutorials.ai_basics.sections.how_it_works.step2.note", "Ähnliche Wörter haben ähnliche Zahlenmuster")}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>3</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step3.title", "Aufmerksamkeit und Kontext (Self-Attention)")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step3.description",
                                                    "Das Modell schaut sich alle Wörter gleichzeitig an und entscheidet, welche Wörter für das Verständnis des Satzes wichtig sind und wie sie zusammenhängen."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Beispiel:</strong>
                                                </Text>
                                                <div className={styles.attentionExample}>
                                                    <Text size={200}>
                                                        Im Satz "Der Ball liegt im <strong>Park</strong>" bezieht sich "liegt" hauptsächlich auf "
                                                        <strong>Ball</strong>" und "<strong>Park</strong>".
                                                    </Text>
                                                    <div className={styles.attentionVisualization}>
                                                        <div className={styles.attentionConnection}>
                                                            <span className={styles.word}>Ball</span>
                                                            <span className={styles.connectionLine}>━━━</span>
                                                            <span className={styles.word}>liegt</span>
                                                            <span className={styles.connectionLine}>━━━</span>
                                                            <span className={styles.word}>Park</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>4</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step4.title", "Informationen verarbeiten (Feed-Forward)")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step4.description",
                                                    "Die zusammengeführten Informationen werden durch mehrere Schichten von mathematischen Berechnungen geschickt, um komplexe Muster zu erkennen und Bedeutungen zu verstehen."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Analogie:</strong>
                                                </Text>
                                                <Text size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.how_it_works.step4.analogy",
                                                        "Wie ein Detektiv, der aus verschiedenen Hinweisen Schlüsse zieht und das große Bild zusammenfügt."
                                                    )}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>5</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step5.title", "Vorhersage des nächsten Wortes")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step5.description",
                                                    "Basierend auf allem, was das Modell verarbeitet hat, erstellt es eine Wahrscheinlichkeitsliste für das nächste Wort. Das wahrscheinlichste Wort wird ausgewählt."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Beispiel für "Das Wetter ist heute...":</strong>
                                                </Text>
                                                <div className={styles.predictionExample}>
                                                    <div className={styles.prediction}>
                                                        <span className={styles.word}>schön</span>
                                                        <span className={styles.probability}>35%</span>
                                                    </div>
                                                    <div className={styles.prediction}>
                                                        <span className={styles.word}>sonnig</span>
                                                        <span className={styles.probability}>25%</span>
                                                    </div>
                                                    <div className={styles.prediction}>
                                                        <span className={styles.word}>regnerisch</span>
                                                        <span className={styles.probability}>20%</span>
                                                    </div>
                                                    <div className={styles.prediction}>
                                                        <span className={styles.word}>kalt</span>
                                                        <span className={styles.probability}>10%</span>
                                                    </div>
                                                    <div className={styles.prediction}>
                                                        <span className={styles.word}>...</span>
                                                        <span className={styles.probability}>10%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>6</div>
                                        <div className={styles.stepContent}>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.how_it_works.step6.title", "Wiederholung für den ganzen Text")}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step6.description",
                                                    "Dieser Prozess wiederholt sich für jedes neue Wort, bis eine vollständige Antwort entstanden ist. Jedes neue Wort beeinflusst die Vorhersage für das nächste."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>Schritt für Schritt:</strong>
                                                </Text>
                                                <div className={styles.sequenceExample}>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>Eingabe: "Wie ist das Wetter heute?"</span>
                                                    </div>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>Schritt 1: "Wie ist das Wetter heute?" → "Das"</span>
                                                    </div>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>Schritt 2: "... heute? Das" → "Wetter"</span>
                                                    </div>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>Schritt 3: "... Das Wetter" → "ist"</span>
                                                    </div>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>Schritt 4: "... Wetter ist" → "heute"</span>
                                                    </div>
                                                    <div className={styles.sequence}>
                                                        <span className={styles.context}>...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.highlightBox}>
                                    <Text as="p" weight="semibold">
                                        {t("tutorials.ai_basics.sections.how_it_works.key_insight", "Wichtige Erkenntnis:")}
                                    </Text>
                                    <Text as="p">
                                        {t(
                                            "tutorials.ai_basics.sections.how_it_works.key_explanation",
                                            "Ein LLM 'versteht' Text nicht wie ein Mensch, sondern erkennt statistische Muster aus seinem Training. Es weiß, welche Wörter häufig zusammen auftreten und kann so sehr menschlich wirkende Antworten generieren, obwohl es nur mathematische Berechnungen durchführt."
                                        )}
                                    </Text>
                                </div>

                                <Text as="p" className={styles.architectureIntro}>
                                    {t(
                                        "tutorials.ai_basics.sections.how_it_works.architecture_intro",
                                        "Die technische Grundlage für all diese Schritte bildet die sogenannte 'Transformer-Architektur':"
                                    )}
                                </Text>

                                {renderMermaidDiagram(ARCHITECTURE_MERMAID)}

                                <div className={styles.analogyBox}>
                                    <Text as="h4" size={300} weight="semibold">
                                        <span className={styles.emojiIcon}>🏭</span>
                                        {t("tutorials.ai_basics.sections.how_it_works.analogy.title", "Analogie: LLM als Textfabrik")}
                                    </Text>
                                    <Text as="p">
                                        {t(
                                            "tutorials.ai_basics.sections.how_it_works.analogy.description",
                                            "Stellen Sie sich ein LLM wie eine hochmoderne Textfabrik vor:"
                                        )}
                                    </Text>
                                    <ul className={styles.analogyList}>
                                        <li>
                                            <strong>{t("tutorials.ai_basics.sections.how_it_works.analogy.input", "Eingabestation:")}</strong>
                                            {t(
                                                "tutorials.ai_basics.sections.how_it_works.analogy.input_desc",
                                                " Ihr Text wird an der Eingabe entgegengenommen und zerlegt"
                                            )}
                                        </li>
                                        <li>
                                            <strong>{t("tutorials.ai_basics.sections.how_it_works.analogy.analysis", "Analyseabteilung:")}</strong>
                                            {t(
                                                "tutorials.ai_basics.sections.how_it_works.analogy.analysis_desc",
                                                " Jedes Wort wird gründlich untersucht und in Kontext gesetzt"
                                            )}
                                        </li>
                                        <li>
                                            <strong>{t("tutorials.ai_basics.sections.how_it_works.analogy.production", "Produktionslinie:")}</strong>
                                            {t(
                                                "tutorials.ai_basics.sections.how_it_works.analogy.production_desc",
                                                " Basierend auf der Analyse wird Wort für Wort die Antwort 'produziert'"
                                            )}
                                        </li>
                                        <li>
                                            <strong>{t("tutorials.ai_basics.sections.how_it_works.analogy.quality", "Qualitätskontrolle:")}</strong>
                                            {t(
                                                "tutorials.ai_basics.sections.how_it_works.analogy.quality_desc",
                                                " Jedes Wort wird auf Plausibilität und Kontext geprüft"
                                            )}
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* What LLMs have access to */}
                            <div id="section-access" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <Search24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.ai_basics.sections.access.title", "Was weiß ein Sprachmodell?")}
                                    </Text>
                                </div>

                                <div className={styles.conceptGrid}>
                                    <div className={styles.conceptCard}>
                                        <ChartMultiple24Regular className={styles.conceptIcon} />
                                        <Text as="h4" size={300} weight="semibold">
                                            {t("tutorials.ai_basics.sections.access.training_data.title", "Trainingsdaten")}
                                        </Text>
                                        <Text as="p" size={200}>
                                            {t(
                                                "tutorials.ai_basics.sections.access.training_data.description",
                                                "LLMs greifen auf die Muster und Informationen zu, die sie während ihres Trainings gelernt haben. Dies umfasst Allgemeinwissen, Sprachstrukturen und Fakten bis zu einem bestimmten Zeitpunkt."
                                            )}
                                        </Text>
                                    </div>

                                    <div className={styles.conceptCard}>
                                        <TextBulletListSquare24Regular className={styles.conceptIcon} />
                                        <Text as="h4" size={300} weight="semibold">
                                            {t("tutorials.ai_basics.sections.access.conversation.title", "Aktuelle Konversation")}
                                        </Text>
                                        <Text as="p" size={200}>
                                            {t(
                                                "tutorials.ai_basics.sections.access.conversation.description",
                                                "Das Modell hat Zugriff auf den aktuellen Gesprächsverlauf, um kontextbezogene und zusammenhängende Antworten zu geben."
                                            )}
                                        </Text>
                                    </div>

                                    <div className={styles.conceptCard}>
                                        <Code24Regular className={styles.conceptIcon} />
                                        <Text as="h4" size={300} weight="semibold">
                                            {t("tutorials.ai_basics.sections.access.tools.title", "Erweiterte Werkzeuge")}
                                        </Text>
                                        <Text as="p" size={200}>
                                            {t(
                                                "tutorials.ai_basics.sections.access.tools.description",
                                                "Moderne KI-Systeme können mit zusätzlichen Werkzeugen ausgestattet werden, wie Internet-Suche, Code-Ausführung oder Datenbankzugriff, um aktuellere oder spezifischere Informationen zu liefern."
                                            )}
                                        </Text>
                                    </div>
                                </div>

                                {/* Access Mermaid diagram */}
                                {renderMermaidDiagram(DATA_MERMAID)}
                            </div>

                            {/* Conclusion section */}
                            <div id="section-conclusion" className={styles.contentSection}>
                                <div className={styles.sectionTitle}>
                                    <BrainCircuit24Regular className={styles.sectionIcon} />
                                    <Text as="h3" size={500} weight="semibold">
                                        {t("tutorials.ai_basics.sections.conclusion.title", "Fazit")}
                                    </Text>
                                </div>

                                <div className={styles.conclusionBox}>
                                    <Text as="p" className={styles.conclusionIntro}>
                                        {t(
                                            "tutorials.ai_basics.sections.conclusion.intro",
                                            "Jetzt wissen Sie, wie KI-Sprachmodelle funktionieren! Hier sind die wichtigsten Punkte:"
                                        )}
                                    </Text>

                                    <div className={styles.keyInsights}>
                                        <div className={styles.insightItem}>
                                            <div className={styles.insightIcon}>
                                                <LearningApp24Regular />
                                            </div>
                                            <div className={styles.insightContent}>
                                                <Text as="h4" size={300} weight="semibold">
                                                    {t("tutorials.ai_basics.sections.conclusion.insight1.title", "Lernen und Antworten sind getrennt")}
                                                </Text>
                                                <Text as="p" size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.conclusion.insight1.description",
                                                        "KI-Modelle lernen einmal aus vielen Texten und können dann Fragen beantworten. Beim Antworten lernen sie nichts Neues dazu - sie nutzen nur ihr bereits gespeichertes Wissen."
                                                    )}
                                                </Text>
                                            </div>
                                        </div>

                                        <div className={styles.insightItem}>
                                            <div className={styles.insightIcon}>
                                                <DataArea24Regular />
                                            </div>
                                            <div className={styles.insightContent}>
                                                <Text as="h4" size={300} weight="semibold">
                                                    {t("tutorials.ai_basics.sections.conclusion.insight2.title", "Wort für Wort Vorhersagen")}
                                                </Text>
                                                <Text as="p" size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.conclusion.insight2.description",
                                                        "KI funktioniert einfach: Sie rät immer das nächste passende Wort. So entstehen ganze Antworten - Wort für Wort. Die KI 'versteht' nicht wirklich, sondern erkennt Muster."
                                                    )}
                                                </Text>
                                            </div>
                                        </div>

                                        <div className={styles.insightItem}>
                                            <div className={styles.insightIcon}>
                                                <TextBulletListSquare24Regular />
                                            </div>
                                            <div className={styles.insightContent}>
                                                <Text as="h4" size={300} weight="semibold">
                                                    {t("tutorials.ai_basics.sections.conclusion.insight3.title", "Klare Fragen = bessere Antworten")}
                                                </Text>
                                                <Text as="p" size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.conclusion.insight3.description",
                                                        "Je genauer Sie fragen, desto besser wird die Antwort. Sagen Sie der KI, was Sie brauchen und geben Sie genug Details mit."
                                                    )}
                                                </Text>
                                            </div>
                                        </div>

                                        <div className={styles.insightItem}>
                                            <div className={styles.insightIcon}>
                                                <Search24Regular />
                                            </div>
                                            <div className={styles.insightContent}>
                                                <Text as="h4" size={300} weight="semibold">
                                                    {t("tutorials.ai_basics.sections.conclusion.insight4.title", "Verschiedene Wissensquellen")}
                                                </Text>
                                                <Text as="p" size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.conclusion.insight4.description",
                                                        "KI nutzt ihr gelerntes Wissen, das aktuelle Gespräch und kann auch zusätzliche Hilfsmittel bekommen (wie Internet-Suche), um Ihnen zu helfen."
                                                    )}
                                                </Text>
                                            </div>
                                        </div>
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

export default AIBasicsTutorial;
