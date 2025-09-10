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
import TutorialProgress from "./TutorialProgress";
import { useTutorialProgress } from "./useTutorialProgress";
import styles from "./AIBasicsTutorial.module.css";
import { TutorialNavigationProps, TutorialSection } from "./TutorialTypes";

const DATA_MERMAID = `graph LR
    subgraph Training ["📚 Erlerntes Wissen aus Training"]
        direction TB
        TrainingData["📖 Trainingsdaten<br/>(Terabytes an Text)<br/>🌍 Globale Wissenssammlung"]

        subgraph Knowledge ["🧠 Wissenskategorien"]
            direction LR
            GeneralKnowledge["🌍 Allgemeinwissen<br/>• Fakten & Konzepte<br/>• Sprachstrukturen<br/>• Mathematik & Logik<br/>• Wissenschaftliche Erkenntnisse<br/>• Kulturelles Wissen"]
            HistoricalContent["📜 Historische Inhalte<br/>• Bücher & Literatur<br/>• Enzyklopädien & Lexika<br/>• Websites & Blogs<br/>• Wissenschaftliche Papers<br/>• News & Zeitungsartikel<br/>• Wikipedia & Fachportale"]
            SyntheticData["🔧 Künstliche Trainingsdaten<br/>• Generierte Beispiele<br/>• Strukturierte Dialoge<br/>• Q&A Paare<br/>• Code-Kommentare<br/>• Übersetzungspaare"]
        end

        TrainingData --> GeneralKnowledge
        TrainingData --> HistoricalContent
        TrainingData --> SyntheticData
    end

    subgraph Context ["💬 Aktueller Kontext"]
        direction TB
        CurrentContext["🗨️ Gesprächskontext<br/>Dynamische Informationen"]

        subgraph ContextDetails ["📝 Kontextquellen"]
            direction LR
            UserInput["👤 Ihre Eingabe<br/>• Aktuelle Frage<br/>• Spezifische Anfrage<br/>• Zusätzliche Details<br/>• Präferenzen"]
            ChatHistory["📝 Gesprächsverlauf<br/>• Vorherige Nachrichten<br/>• Themenkontext<br/>• Referenzen<br/>• Kontinuität"]
            SystemPrompt["⚙️ Systemprompt<br/>• Verhaltensvorgaben<br/>• Rolle & Expertise<br/>• Antwortformat<br/>• Sicherheitsregeln"]
        end

        UserInput --> CurrentContext
        ChatHistory --> CurrentContext
        SystemPrompt --> CurrentContext
    end

    subgraph Tools ["🛠️ Externe Werkzeuge & Hilfsmittel"]
        direction TB
        ToolsMain["🔧 Zusätzliche Fähigkeiten<br/>Erweiterte Funktionalitäten"]

        subgraph ToolTypes ["🎯 Werkzeugkategorien"]
            direction LR
            WebSearch["🌐 Internet-Suche<br/>• Aktuelle Informationen<br/>• News & Updates<br/>• Fachspezifische Daten<br/>• Echtzeitdaten"]
            CodeExecution["💻 Code-Ausführung<br/>• Python & JavaScript<br/>• Berechnungen<br/>• Datenanalyse<br/>• Algorithmen testen"]
            DatabaseAccess["🗄️ Datenbankzugriff<br/>• Unternehmensdaten<br/>• Spezielle Wissensbasen<br/>• APIs & Services<br/>• Strukturierte Abfragen"]
            FileAccess["📁 Dateizugriff<br/>• Dokumente analysieren<br/>• PDFs & Images<br/>• Uploads verarbeiten<br/>• Kontext erweitern"]
        end

        WebSearch --> ToolsMain
        CodeExecution --> ToolsMain
        DatabaseAccess --> ToolsMain
        FileAccess --> ToolsMain
    end

    subgraph LLMCenter ["🤖 Large Language Model"]
        direction TB
        LLM["🧠 Zentrale Verarbeitungseinheit<br/>🎯 Transformer-Architektur<br/>⚡ Neuronale Netzwerke<br/>🔍 Pattern Recognition<br/>💡 Intelligente Antworten"]
    end

    %% Main connections
    Knowledge --> LLM
    CurrentContext --> LLM
    ToolsMain --> LLM

    %% Styling
    classDef llmStyle fill:#6366f1,stroke:#4338ca,stroke-width:4px,color:white,font-weight:bold,font-size:14px
    classDef trainingStyle fill:#10b981,stroke:#059669,stroke-width:2px,color:white,font-weight:bold
    classDef contextStyle fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:white,font-weight:bold
    classDef toolsStyle fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:white,font-weight:bold
    classDef mainStyle fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:white,font-weight:bold

    class LLM llmStyle
    class TrainingData,GeneralKnowledge,HistoricalContent,SyntheticData trainingStyle
    class CurrentContext,UserInput,ChatHistory,SystemPrompt contextStyle
    class ToolsMain,WebSearch,CodeExecution,DatabaseAccess,FileAccess toolsStyle
    class Knowledge,ContextDetails,ToolTypes mainStyle`;

const TRAINING_MERMAID = `flowchart TB
    subgraph DataCollection ["📊 Phase 1: Datensammlung & Quellen"]
        direction LR
        subgraph Sources ["🌐 Datenquellen"]
            Internet["🌐 Internet-Texte<br/>• Websites & Blogs<br/>• Foren & Social Media"]
            Literature["📚 Literatur<br/>• Bücher & Fachwerke<br/>• Lehrbücher"]
            Academic["🎓 Wissenschaft<br/>• Research Papers<br/>• Journals & Studien"]
            Reference["📖 Referenzen<br/>• Wikipedia<br/>• Enzyklopädien"]
        end

        subgraph Volume ["📈 Datenvolumen"]
            DataSize["� Gigantische Mengen<br/>🗄️ Terabytes an Text<br/>📄 Milliarden von Seiten<br/>🌍 100+ Sprachen<br/>⏰ Jahre an Inhalten"]
            Quality["✅ Qualitätskriterien<br/>📝 Lesbare Texte<br/>🎯 Informativ & akkurat<br/>🔍 Faktenchecks<br/>⚖️ Ausgewogen"]
        end

        Internet --> DataSize
        Literature --> DataSize
        Academic --> DataSize
        Reference --> DataSize
        DataSize --> Quality
    end

    subgraph DataPrep ["🔧 Phase 2: Datenaufbereitung & Bereinigung"]
        direction LR
        subgraph Cleaning ["🧹 Bereinigungsschritte"]
            RemoveDuplicates["🔍 Duplikate entfernen<br/>• Identische Texte<br/>• Ähnliche Inhalte<br/>• Near-Duplicates<br/>• Redundanzen"]
            QualityFilter["✅ Qualitätskontrolle<br/>• Spam erkennen<br/>• Broken Text reparieren<br/>• Encoding-Probleme<br/>• Unvollständige Texte"]
            ContentFilter["�️ Inhaltsfilterung<br/>• Datenschutz beachten<br/>• Urheberrecht prüfen<br/>• Sensible Daten<br/>• Toxische Inhalte"]
        end

        subgraph Tokenization ["✂️ Tokenisierung & Strukturierung"]
            TokenSplit["🔤 Tokenisierung<br/>• Text → Tokens<br/>• Wörter & Subwörter"]
            VocabBuild["📚 Vokabular<br/>• Token-Häufigkeiten<br/>• Multi-linguales Vocab"]
            Encoding["🔢 Kodierung<br/>• Token → IDs<br/>• Batch Preparation"]
        end

        RemoveDuplicates --> TokenSplit
        QualityFilter --> TokenSplit
        ContentFilter --> TokenSplit
        TokenSplit --> VocabBuild
        VocabBuild --> Encoding
    end

    subgraph Training ["🎯 Phase 3: Training & Lernprozess"]
        direction LR
        subgraph PreTraining ["📖 Vortraining"]
            NextToken["🎯 Next-Token Prediction<br/>⚡ Massive Skalierung"]
        end

        subgraph FineTuning ["🎨 Feinabstimmung (Supervised)"]
            TaskSpecific["📋 Aufgaben-spezifisch<br/>• Instruktionsdaten<br/>• Q&A Paare<br/>• Dialogformate<br/>• Spezielle Fähigkeiten"]
            Supervised["👨‍🏫 Überwachtes Lernen<br/>⏱️ Tage bis Wochen<br/>� Tausende Euro<br/>🎯 Zielgerichtetes Training<br/>📊 Labeled Data"]
        end

        subgraph RLHF ["👥 Human Feedback"]
            HumanFeedback["👩‍💻 Antworten bewerten<br/>🔄 Policy Optimization"]
        end

        NextToken --> TaskSpecific
        TaskSpecific --> HumanFeedback
    end

    subgraph Deployment ["🚀 Phase 4: Bereitstellung"]
        direction TB
        Evaluation["📊 Evaluierung<br/>📈 Tests & Benchmarks<br/>🛡️ Sicherheitstests"]
        Production["🌟 Produktion<br/>🔧 Model Optimization<br/>🏗️ Infrastruktur"]
        UserReady["👨‍💻 Benutzer-Ready<br/>💻 Web Interfaces<br/>📚 Documentation"]

        Evaluation --> Production
        Production --> UserReady
        Infrastructure --> UserReady
    end

    %% Main Flow
    Quality --> RemoveDuplicates
    Encoding --> NextToken
    HumanFeedback --> Evaluation

    %% Feedback loops
    Evaluation -.->|"❌ Issues"| HumanFeedback
    UserReady -.->|"📈 Improvements"| HumanFeedback

    %% Styling
    classDef dataStyle fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:white,font-weight:bold
    classDef processStyle fill:#10b981,stroke:#059669,stroke-width:2px,color:white,font-weight:bold
    classDef trainingStyle fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:white,font-weight:bold
    classDef deployStyle fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:white,font-weight:bold
    classDef phaseStyle fill:#ef4444,stroke:#dc2626,stroke-width:3px,color:white,font-weight:bold

    class Sources,Volume dataStyle
    class Cleaning,Processing processStyle
    class PreTraining,FineTuning,RLHF trainingStyle
    class Evaluation,Production,UserReady deployStyle
    class DataCollection,DataPrep,Training,Deployment phaseStyle`;

const ARCHITECTURE_MERMAID = `flowchart TD
    subgraph "🎯 Eingabe-Verarbeitung"
        Input["📝 Benutzer-Eingabe<br/>'Wie ist das Wetter heute?'<br/>🔤 Roher Text"]
        Tokenize["✂️ Tokenisierung<br/>🔗 [Wie][ist][das][Wetter][heute][?]<br/>📊 6 Tokens"]
        Embedding["🔢 Wort-Embeddings<br/>📈 Jedes Token → Zahlenvektor<br/>🎨 Semantische Bedeutung"]
    end

    subgraph "🧠 Neuronale Verarbeitung"
        subgraph "🔍 Attention-Mechanismus"
            SelfAttention["�️ Self-Attention<br/>🤔 'Welche Wörter sind wichtig?'<br/>🔗 Beziehungen zwischen Tokens<br/>⭐ Fokus auf relevante Teile"]
            MultiHead["🎭 Multi-Head Attention<br/>👀 Verschiedene Perspektiven<br/>🔄 Parallel processing<br/>📊 8-16 Attention Heads"]
        end

        subgraph "⚙️ Feed-Forward Netzwerk"
            FFN["🔧 Feed-Forward Layer<br/>🎯 Muster erkennen & transformieren<br/>📈 Nicht-lineare Aktivierung<br/>🧮 Millionen Parameter"]
            Norm["📏 Layer Normalization<br/>⚖️ Stabilisierung<br/>🔄 Residual Connections<br/>📊 Bessere Konvergenz"]
        end
    end

    subgraph "🎲 Ausgabe-Generierung"
        Predict["🎯 Nächstes Token vorhersagen<br/>📊 Wahrscheinlichkeitsverteilung<br/>🎲 Sampling-Strategien<br/>🔥 Temperature Control"]
        TopK["🏆 Top-K Auswahl<br/>📈 'schön': 35%<br/>☀️ 'sonnig': 25%<br/>🌧️ 'regnerisch': 20%"]
        Generation["🔄 Iterative Generierung<br/>➡️ Token für Token<br/>🛑 Stop-Kriterien<br/>📝 Kohärente Antwort"]
    end

    subgraph "💬 Finale Ausgabe"
        Output["✨ Fertige Antwort<br/>'Das Wetter ist heute schön<br/>und sonnig mit 23°C.'<br/>🎨 Natürliche Sprache"]
        PostProcess["🔧 Nachbearbeitung<br/>✅ Qualitätskontrolle<br/>🛡️ Safety Filter<br/>📖 Formatierung"]
    end

    %% Main Flow
    Input --> Tokenize
    Tokenize --> Embedding
    Embedding --> SelfAttention
    SelfAttention --> MultiHead
    MultiHead --> FFN
    FFN --> Norm
    Norm --> Predict
    Predict --> TopK
    TopK --> Generation
    Generation --> Output
    Output --> PostProcess

    %% Feedback Loop for Generation
    Generation -.->|"🔄 Für jedes neue Token"| SelfAttention

    %% Parallel processing indication
    SelfAttention -.->|"⚡ Parallel"| FFN

    %% Styling
    classDef inputStyle fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:white,font-weight:bold
    classDef processStyle fill:#10b981,stroke:#059669,stroke-width:2px,color:white,font-weight:bold
    classDef attentionStyle fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:white,font-weight:bold
    classDef outputStyle fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:white,font-weight:bold
    classDef finalStyle fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:white,font-weight:bold

    class Input,Tokenize,Embedding inputStyle
    class FFN,Norm processStyle
    class SelfAttention,MultiHead attentionStyle
    class Predict,TopK,Generation outputStyle
    class Output,PostProcess finalStyle`;

export const AIBasicsTutorial = ({ onPreviousTutorial, onNextTutorial, onBackToTop, currentTutorialId, allTutorials }: TutorialNavigationProps = {}) => {
    const { t } = useTranslation();

    // Custom sections for AI Basics tutorial - memoized to prevent recreation
    const tutorialSections = React.useMemo<TutorialSection[]>(
        () => [
            { id: "intro", translationKey: "tutorials.ai_basics.sections.titles.intro", defaultLabel: "Was sind Sprachmodelle" },
            { id: "training", translationKey: "tutorials.ai_basics.sections.titles.training", defaultLabel: "Training" },
            { id: "functionality", translationKey: "tutorials.ai_basics.sections.titles.functionality", defaultLabel: "Funktionsweise" },
            { id: "access", translationKey: "tutorials.ai_basics.sections.titles.access", defaultLabel: "Was weiß ein Sprachmodell?" },
            { id: "tips", translationKey: "tutorials.ai_basics.sections.titles.conclusion", defaultLabel: "Fazit & Ausblick" }
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

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.ai_basics.sections.conclusion.insight1.title", "Lernen und Antworten sind getrennt"),
            description: t(
                "tutorials.ai_basics.sections.conclusion.insight1.description",
                "KI-Modelle lernen einmal aus vielen Texten und können dann Fragen beantworten. Beim Antworten lernen sie nichts Neues dazu - sie nutzen nur ihr bereits gespeichertes Wissen."
            ),
            type: "info"
        },
        {
            title: t("tutorials.ai_basics.sections.conclusion.insight2.title", "Wort für Wort Vorhersagen"),
            description: t(
                "tutorials.ai_basics.sections.conclusion.insight2.description",
                "KI funktioniert einfach: Sie rät immer das nächste passende Wort. So entstehen ganze Antworten - Wort für Wort. Die KI 'versteht' nicht wirklich, sondern erkennt Muster."
            ),
            type: "info"
        },
        {
            title: t("tutorials.ai_basics.sections.conclusion.insight3.title", "Klare Fragen = bessere Antworten"),
            description: t(
                "tutorials.ai_basics.sections.conclusion.insight3.description",
                "Je genauer Sie fragen, desto besser wird die Antwort. Sagen Sie der KI, was Sie brauchen und geben Sie genug Details mit."
            ),
            type: "success"
        },
        {
            title: t("tutorials.ai_basics.sections.conclusion.insight4.title", "Verschiedene Wissensquellen"),
            description: t(
                "tutorials.ai_basics.sections.conclusion.insight4.description",
                "KI nutzt ihr gelerntes Wissen, das aktuelle Gespräch und kann auch zusätzliche Hilfsmittel bekommen (wie Internet-Suche), um Ihnen zu helfen."
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
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step2.title",
                                                    "Verarbeitung innerhalb des LLMs. Zentrales Konzept: Attention"
                                                )}
                                            </Text>
                                            <Text as="p" size={200}>
                                                {t(
                                                    "tutorials.ai_basics.sections.how_it_works.step2.description",
                                                    "Das Modell schaut sich alle Wörter an und entscheidet: Welche sind wichtig? Es wandelt Wörter in Zahlen um und nutzt viele Schichten für verschiedene Aufgaben."
                                                )}
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text size={200}>
                                                    <strong>{t("tutorials.ai_basics.sections.how_it_works.step2.example_title", "Einfaches Beispiel:")}</strong>
                                                </Text>
                                                <Text size={200}>
                                                    {t(
                                                        "tutorials.ai_basics.sections.how_it_works.step2.example_text",
                                                        'Bei "Der Hund bellt" konzentriert sich das Modell hauptsächlich auf "Hund" und "bellt" - das sind die wichtigen Wörter.'
                                                    )}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.stepItem}>
                                        <div className={styles.stepNumber}>3</div>
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
                                        <div className={styles.stepNumber}>4</div>
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
                        </div>
                    )
                }}
                tips={tips}
            />
        </div>
    );
};

export default AIBasicsTutorial;
