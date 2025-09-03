import React from "react";
import { useTranslation } from "react-i18next";
import { Text, Divider, Tab, TabList } from "@fluentui/react-components";
import {
    BrainCircuit24Regular,
    DataArea24Regular,
    Database24Regular,
    LearningApp24Regular,
    Search24Regular,
    ChartMultiple24Regular,
    TextBulletListSquare24Regular,
    Code24Regular,
    Shield24Regular,
    BookInformation24Regular,
    PersonRunningFilled,
    LearningApp24Filled
} from "@fluentui/react-icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../../../components/CodeBlockRenderer/CodeBlockRenderer";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { BaseTutorial, TutorialFeature, TutorialTip } from "./BaseTutorial";
import styles from "./AIBasicsTutorial.module.css";

export const AIBasicsTutorial = () => {
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = React.useState<string>("training");

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

    const features: TutorialFeature[] = [
        {
            icon: <DataArea24Regular />,
            title: t("tutorials.ai_basics.features.data.title", "Datenbasiertes Training"),
            description: t(
                "tutorials.ai_basics.features.data.description",
                "KI-Modelle werden mit enormen Mengen an Text und Code trainiert, um Muster zu erkennen."
            )
        },
        {
            icon: <Database24Regular />,
            title: t("tutorials.ai_basics.features.patterns.title", "Mustererkennung"),
            description: t(
                "tutorials.ai_basics.features.patterns.description",
                "LLMs verstehen Zusammenhänge in Texten und können relevante Inhalte generieren."
            )
        },
        {
            icon: <LearningApp24Regular />,
            title: t("tutorials.ai_basics.features.learning.title", "Machine Learning"),
            description: t(
                "tutorials.ai_basics.features.learning.description",
                "Der Lernprozess erfolgt durch die Analyse von Millionen von Beispielen und kontinuierliche Verbesserung."
            )
        }
    ];

    const tips: TutorialTip[] = [
        {
            title: t("tutorials.ai_basics.tips.prompt_clarity.title", "Klare Anfragen stellen"),
            description: t(
                "tutorials.ai_basics.tips.prompt_clarity.description",
                "Je präziser Ihre Anfrage, desto besser kann die KI relevante Informationen liefern. Spezifische Fragen führen zu genaueren Antworten."
            ),
            type: "info"
        },
        {
            title: t("tutorials.ai_basics.tips.limitations.title", "Grenzen kennen"),
            description: t(
                "tutorials.ai_basics.tips.limitations.description",
                "KI-Modelle können falsch liegen oder Dinge 'erfinden'. Überprüfen Sie kritische Informationen immer selbst."
            ),
            type: "warning"
        }
    ];

    return (
        <BaseTutorial
            title={t("tutorials.ai_basics.intro.title", "Grundlagen moderner KI-Systeme")}
            titleIcon={<BrainCircuit24Regular className="sectionIcon" />}
            description={t(
                "tutorials.ai_basics.intro.description",
                "Verstehen Sie, wie moderne KI-Systeme wie Large Language Models (LLMs) funktionieren, trainiert werden und mit welchen Einschränkungen sie arbeiten."
            )}
            features={features}
            example={{
                title: t("tutorials.ai_basics.example.title", "Wie funktionieren Large Language Models?"),
                description: t("tutorials.ai_basics.example.description", "Ein Überblick über die grundlegenden Konzepte und Funktionsweisen von LLMs."),
                component: (
                    <div>
                        {/* Introduction to LLMs section */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <BrainCircuit24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.what_are_llms.title", "Was sind Large Language Models?")}
                                </Text>
                            </div>
                            <Text as="p">
                                {t(
                                    "tutorials.ai_basics.sections.what_are_llms.description",
                                    "Large Language Models (LLMs) sind KI-Systeme, die darauf trainiert wurden, menschliche Sprache zu verstehen und zu generieren. Sie funktionieren durch die Vorhersage des nächstwahrscheinlichen Wortes in einer Sequenz, basierend auf ihrem Training mit enormen Textmengen."
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

                        {/* LLM architecture diagram */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <DataArea24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.architecture.title", "Architektur eines LLM")}
                                </Text>
                            </div>
                            <Text as="p" style={{ marginBottom: "16px" }}>
                                {t(
                                    "tutorials.ai_basics.sections.architecture.description",
                                    "Die Transformer-Architektur bildet das Fundament moderner LLMs. Das folgende Diagramm zeigt vereinfacht, wie diese Modelle Texteingaben verarbeiten und Ausgaben generieren:"
                                )}
                            </Text>

                            {renderMermaidDiagram(`flowchart TD
    Input["Eingabetext"] --> Tokenize["Tokenisierung"]
    Tokenize --> Transformer["Transformer mit Self-Attention\n(Embedding, Self-Attention, Feed-Forward)"]
    Transformer --> Predict["Vorhersage des\nnächsten Tokens"]
    Predict --> Output["Ausgabetext"]

    classDef primary fill:#3B82F6,stroke:#1E3A8A,color:white;
    classDef secondary fill:#6B7280,stroke:#374151,color:white;
    classDef transformer fill:#10B981,stroke:#065F46,color:white;
    class Input,Output primary;
    class Tokenize,Predict secondary;
    class Transformer transformer;`)}
                        </div>

                        {/* Phase tabs */}
                        <div className={styles.phaseContainer}>
                            <Text as="h3" size={600} weight="semibold" className={styles.phasesTitle}>
                                {t("tutorials.ai_basics.sections.phases.title", "Die zwei Phasen eines LLM")}
                            </Text>

                            <TabList selectedValue={selectedTab} onTabSelect={(_, data) => setSelectedTab(data.value as string)} className={styles.phaseTabs}>
                                {" "}
                                <Tab value="training" icon={<LearningApp24Filled />}>
                                    {t("tutorials.ai_basics.sections.phases.training_tab", "1. Training")}
                                </Tab>{" "}
                                <Tab value="inference" icon={<PersonRunningFilled />}>
                                    {t("tutorials.ai_basics.sections.phases.inference_tab", "2. Nutzung (Inferenz)")}
                                </Tab>
                            </TabList>

                            {/* Training Phase Content */}
                            {selectedTab === "training" && (
                                <div className={styles.phaseContent}>
                                    {" "}
                                    <div className={`${styles.phaseHeader} ${styles.trainingPhase}`}>
                                        <LearningApp24Filled className={styles.phaseIcon} />
                                        <Text as="h3" size={500} weight="semibold">
                                            {t("tutorials.ai_basics.sections.training_phase.title", "Die Trainingsphase")}
                                        </Text>
                                    </div>
                                    <Text as="p" className={styles.phaseDescription}>
                                        {t(
                                            "tutorials.ai_basics.sections.training_phase.description",
                                            "Die Trainingsphase findet nur einmal statt, bevor ein LLM überhaupt genutzt werden kann. In dieser Phase 'lernt' das Modell, Sprache zu verstehen und zu generieren. Dies geschieht durch die Analyse enormer Mengen an Textdaten."
                                        )}
                                    </Text>
                                    {/* Training process Mermaid diagram - enhanced with details */}
                                    {renderMermaidDiagram(`flowchart TD
    Data[("Trainingsdaten\n(Terabytes an Text)")] --> Clean["Datenbereinigung\nund Vorbereitung"]
    Clean --> Tokenize["Tokenisierung\nder Texte"]
    Tokenize --> Pretrain["Vortraining\n(Selbstüberwachtes Lernen)"]
    Pretrain --> Finetune["Feinabstimmung\n(Supervisiertes Lernen)"]
    Finetune --> RLHF["RLHF\n(Verstärkendes Lernen\naus Human Feedback)"]
    RLHF --> Deploy["Fertiges\nLLM-Modell"]

    classDef process fill:#22C55E,stroke:#166534,color:white;
    classDef data fill:#3B82F6,stroke:#1E40AF,color:white;
    class Data,Deploy data;
    class Clean,Tokenize,Pretrain,Finetune,RLHF process;`)}
                                    <Text as="p" size={200} style={{ marginTop: "16px", fontWeight: "semibold" }}>
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
                                                    <strong>Beispiel:</strong> "Die Hauptstadt von Deutschland ist [MASKE]."
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
                            )}

                            {/* Inference Phase Content */}
                            {selectedTab === "inference" && (
                                <div className={styles.phaseContent}>
                                    {" "}
                                    <div className={`${styles.phaseHeader} ${styles.inferencePhase}`}>
                                        <PersonRunningFilled className={styles.phaseIcon} />
                                        <Text as="h3" size={500} weight="semibold">
                                            {t("tutorials.ai_basics.sections.inference_phase.title", "Die Nutzungsphase (Inferenz)")}
                                        </Text>
                                    </div>
                                    <Text as="p" className={styles.phaseDescription}>
                                        {t(
                                            "tutorials.ai_basics.sections.inference_phase.description",
                                            "Nach dem Training wird das Modell für die eigentliche Anwendung eingesetzt. In dieser Phase werden keine neuen Daten gelernt, sondern das vorhandene Wissen genutzt, um Anfragen zu beantworten und Texte zu generieren. Die Inferenz ist der Prozess, den Sie sehen, wenn Sie mit einem LLM interagieren."
                                        )}
                                    </Text>
                                    {/* Inference process diagram */}
                                    {renderMermaidDiagram(`flowchart LR
    User[("Nutzer-\nAnfrage")] --> Prompt["Prompt\nVerarbeitung"]
    Prompt --> Tokenize["Tokenisierung"]
    Tokenize --> Process["Verarbeitung im\nModell"]
    Process --> Generate["Token-\nGenerierung"]
    Generate --> Response["Antwort\nan Nutzer"]

    classDef user fill:#8B5CF6,stroke:#4C1D95,color:white;
    classDef process fill:#10B981,stroke:#065F46,color:white;
    classDef result fill:#3B82F6,stroke:#1E3A8A,color:white;
    class User,Response user;
    class Prompt,Tokenize,Process,Generate process;`)}
                                    <div className={styles.examplesContainer}>
                                        <div className={styles.exampleItem}>
                                            <Text as="h4" size={300} weight="semibold">
                                                <span className={styles.emojiIcon}>🔤</span> Tokenisierung während der Inferenz:
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text as="p" size={200}>
                                                    <strong>Nutzereingabe:</strong> "Wie funktioniert KI?"
                                                </Text>
                                                <div className={styles.tokenVisualization}>
                                                    <span className={styles.token}>Wie</span>
                                                    <span className={styles.token}>funktioniert</span>
                                                    <span className={styles.token}>KI</span>
                                                    <span className={styles.token}>?</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.exampleItem}>
                                            <Text as="h4" size={300} weight="semibold">
                                                <span className={styles.emojiIcon}>🧠</span> Verarbeitung im Transformer:
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <div className={styles.processDiagram}>
                                                    <div className={styles.processStep}>
                                                        <span className={styles.stepIcon}>📊</span>
                                                        <span className={styles.stepText}>Embeddings</span>
                                                    </div>
                                                    <div className={styles.processArrow}>→</div>
                                                    <div className={styles.processStep}>
                                                        <span className={styles.stepIcon}>🔍</span>
                                                        <span className={styles.stepText}>Self-Attention</span>
                                                    </div>
                                                    <div className={styles.processArrow}>→</div>
                                                    <div className={styles.processStep}>
                                                        <span className={styles.stepIcon}>⚙️</span>
                                                        <span className={styles.stepText}>Verarbeitung</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.exampleItem}>
                                            <Text as="h4" size={300} weight="semibold">
                                                <span className={styles.emojiIcon}>🔮</span> Vorhersage und Generierung:
                                            </Text>
                                            <div className={styles.exampleBox}>
                                                <Text as="p" size={200}>
                                                    <strong>Nach Eingabe:</strong> "Wie funktioniert KI?"
                                                </Text>
                                                <div className={styles.generationProcess}>
                                                    <div className={styles.generationStep}>
                                                        <span className={styles.tokenOutput}>Künstliche</span>
                                                    </div>
                                                    <div className={styles.generationStep}>
                                                        <span className={styles.tokenOutput}>Intelligenz</span>
                                                    </div>
                                                    <div className={styles.generationStep}>
                                                        <span className={styles.tokenOutput}>funktioniert</span>
                                                    </div>
                                                    <div className={styles.generationStep}>
                                                        <span className={styles.tokenOutput}>durch...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.keyConcept}>
                                        <BookInformation24Regular className={styles.keyConceptIcon} />
                                        <div>
                                            <Text as="h4" size={300} weight="semibold">
                                                {t("tutorials.ai_basics.sections.inference_phase.key_concept", "Wichtig zu verstehen:")}
                                            </Text>
                                            <Text as="p">
                                                {t(
                                                    "tutorials.ai_basics.sections.inference_phase.key_explanation",
                                                    "Während der Inferenz lernt das Modell nichts Neues. Es nutzt nur sein während des Trainings erworbenes 'Wissen'. Das Modell generiert Text, indem es für jeden Schritt das nächstwahrscheinlichste Token (Wort oder Wortfragment) vorhersagt, basierend auf dem vorherigen Kontext."
                                                )}
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* What LLMs have access to */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <Search24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.access.title", "Worauf haben LLMs Zugriff?")}
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
                            {renderMermaidDiagram(`mindmap
  root((LLM\nZugriff))
    Training
      Allgemeines Wissen
        Fakten
        Konzepte
        Sprachmuster
      Inhalte bis zum Trainingszeitpunkt
        Bücher
        Websites
        Wissenschaftliche Artikel
    Konversation
      Aktuelle Eingaben
      Gesprächsverlauf
      Kontext-Window
    Erweiterungen
      Tools/Plugins
        Internet-Suche
        Rechner
        Datenbanken
      API-Zugriffe
        Externe Dienste
        Aktuelle Daten`)}
                        </div>

                        {/* Limitations */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <Shield24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.limitations.title", "Einschränkungen von LLMs")}
                                </Text>
                            </div>

                            <div className={styles.limitationsBox}>
                                <Text as="p" weight="semibold">
                                    {t("tutorials.ai_basics.sections.limitations.hallucinations.title", "Halluzinationen:")}
                                </Text>
                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.limitations.hallucinations.description",
                                        "LLMs können manchmal Informationen 'erfinden', die falsch oder irreführend sind, besonders wenn sie unsicher sind oder außerhalb ihres Trainingswissens antworten müssen."
                                    )}
                                </Text>

                                <Divider style={{ margin: "12px 0" }} />

                                <Text as="p" weight="semibold">
                                    {t("tutorials.ai_basics.sections.limitations.context.title", "Kontextfenster:")}
                                </Text>
                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.limitations.context.description",
                                        "LLMs haben ein begrenztes 'Gedächtnis' für die aktuelle Konversation, genannt Kontextfenster. Sie können nur eine bestimmte Anzahl an Tokens (Wörter oder Wortteile) verarbeiten."
                                    )}
                                </Text>

                                <Divider style={{ margin: "12px 0" }} />

                                <Text as="p" weight="semibold">
                                    {t("tutorials.ai_basics.sections.limitations.knowledge.title", "Wissensgrenze:")}
                                </Text>
                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.limitations.knowledge.description",
                                        "Das Wissen eines LLMs ist auf den Zeitpunkt begrenzt, bis zu dem es trainiert wurde. Ohne spezielle Tools haben sie keinen Zugriff auf aktuelle Ereignisse oder Entwicklungen nach diesem Zeitpunkt."
                                    )}
                                </Text>
                            </div>
                        </div>

                        {/* Best Practices */}
                        <div className={styles.infoBox}>
                            <Text as="h4" size={300} weight="semibold">
                                {t("tutorials.ai_basics.sections.best_practices.title", "Effektive Kommunikation mit LLMs")}
                            </Text>
                            <Text as="p">
                                {t(
                                    "tutorials.ai_basics.sections.best_practices.description",
                                    "Für die besten Ergebnisse, seien Sie präzise in Ihren Anfragen, geben Sie relevanten Kontext an und überprüfen Sie wichtige Fakten mit zuverlässigen Quellen. Die Qualität der Antworten hängt stark von der Klarheit und Genauigkeit Ihrer Anfragen ab."
                                )}
                            </Text>
                        </div>

                        {/* Comparison between Training and Inference */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <ChartMultiple24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.comparison.title", "Training vs. Inferenz im Überblick")}
                                </Text>
                            </div>
                            <Text as="p" style={{ marginBottom: "16px" }}>
                                {t(
                                    "tutorials.ai_basics.sections.comparison.description",
                                    "Die folgende Übersicht zeigt die wichtigsten Unterschiede zwischen der Trainings- und der Nutzungsphase eines LLM:"
                                )}
                            </Text>

                            {renderMermaidDiagram(`graph TD
    subgraph Training["1. Training (einmalig)"]
        direction LR
        Data["Große Datenmengen"] --> Learn["Lernen von Mustern"]
        Learn --> Params["Millionen/Milliarden\nParameter"]
        Params --> Model["Trainiertes Modell"]
    end

    subgraph Inference["2. Inferenz (bei jeder Nutzung)"]
        direction LR
        Prompt["Nutzeranfrage"] --> Process["Verarbeitung\nim Modell"]
        Process --> Response["Generierte\nAntwort"]
    end

    Training -.- Inference

    classDef trainingNode fill:#22C55E,stroke:#166534,color:white;
    classDef inferenceNode fill:#8B5CF6,stroke:#4C1D95,color:white;
    classDef modelNode fill:#3B82F6,stroke:#1E3A8A,color:white;

    class Data,Learn,Params trainingNode;
    class Prompt,Process,Response inferenceNode;
    class Model modelNode;`)}

                            <div className={styles.comparisonTable}>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonHeader}>Aspekt</div>
                                    <div className={`${styles.comparisonHeader} ${styles.trainingColumn}`}>Training</div>
                                    <div className={`${styles.comparisonHeader} ${styles.inferenceColumn}`}>Inferenz (Nutzung)</div>
                                </div>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonCell}>Wann?</div>
                                    <div className={`${styles.comparisonCell} ${styles.trainingColumn}`}>Einmalig vor der Bereitstellung</div>
                                    <div className={`${styles.comparisonCell} ${styles.inferenceColumn}`}>Bei jeder Nutzung des Modells</div>
                                </div>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonCell}>Daten</div>
                                    <div className={`${styles.comparisonCell} ${styles.trainingColumn}`}>Terabytes an Textdaten</div>
                                    <div className={`${styles.comparisonCell} ${styles.inferenceColumn}`}>Nur aktuelle Eingabe und Konversation</div>
                                </div>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonCell}>Prozess</div>
                                    <div className={`${styles.comparisonCell} ${styles.trainingColumn}`}>Lernen und Aktualisieren von Parametern</div>
                                    <div className={`${styles.comparisonCell} ${styles.inferenceColumn}`}>Anwenden des gelernten Wissens</div>
                                </div>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonCell}>Ressourcen</div>
                                    <div className={`${styles.comparisonCell} ${styles.trainingColumn}`}>Enorm (tausende GPUs, Wochen/Monate)</div>
                                    <div className={`${styles.comparisonCell} ${styles.inferenceColumn}`}>Moderat (wenige GPUs, Sekunden/Minuten)</div>
                                </div>
                                <div className={styles.comparisonRow}>
                                    <div className={styles.comparisonCell}>Wer führt es durch?</div>
                                    <div className={`${styles.comparisonCell} ${styles.trainingColumn}`}>KI-Forscher und -Entwickler</div>
                                    <div className={`${styles.comparisonCell} ${styles.inferenceColumn}`}>Endnutzer</div>
                                </div>
                            </div>
                        </div>

                        {/* Conclusion section */}
                        <div className={styles.contentSection}>
                            <div className={styles.sectionTitle}>
                                <BrainCircuit24Regular className={styles.sectionIcon} />
                                <Text as="h3" size={500} weight="semibold">
                                    {t("tutorials.ai_basics.sections.conclusion.title", "Fazit: Das Zusammenspiel von Training und Inferenz")}
                                </Text>
                            </div>

                            <div className={styles.conclusionBox}>
                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.conclusion.main",
                                        "Die Trennung zwischen Training und Inferenz ist ein fundamentales Konzept in der KI:"
                                    )}
                                </Text>

                                <ul className={styles.conclusionList}>
                                    <li>
                                        <strong>{t("tutorials.ai_basics.sections.conclusion.point1_title", "Training = Lernen:")}</strong>{" "}
                                        {t(
                                            "tutorials.ai_basics.sections.conclusion.point1_desc",
                                            "Ein aufwändiger, einmaliger Prozess, bei dem das Modell aus riesigen Datenmengen 'lernt' und komplexe Muster erkennt."
                                        )}
                                    </li>
                                    <li>
                                        <strong>{t("tutorials.ai_basics.sections.conclusion.point2_title", "Inferenz = Anwenden:")}</strong>{" "}
                                        {t(
                                            "tutorials.ai_basics.sections.conclusion.point2_desc",
                                            "Das Anwenden des gelernten Wissens, um auf neue Eingaben zu reagieren, ohne dabei neue Informationen zu lernen."
                                        )}
                                    </li>
                                </ul>

                                <Text as="p">
                                    {t(
                                        "tutorials.ai_basics.sections.conclusion.analogy",
                                        "Als Analogie: Das Training entspricht dem jahrelangen Schulbesuch und Studium eines Menschen, während die Inferenz dem Anwenden dieses Wissens in einem Gespräch entspricht. Ein Mensch lernt während einer Unterhaltung natürlich dazu – ein LLM hingegen kann dies ohne explizites Nachtraining nicht."
                                    )}
                                </Text>

                                <div className={styles.finalNote}>
                                    <Text as="p" weight="semibold">
                                        {t(
                                            "tutorials.ai_basics.sections.conclusion.final_note",
                                            "Die Qualität und Fähigkeiten eines LLM werden hauptsächlich durch sein Training bestimmt, aber die Qualität der Antworten hängt maßgeblich davon ab, wie Sie mit dem Modell während der Inferenz interagieren."
                                        )}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }}
            tips={tips}
        />
    );
};

export default AIBasicsTutorial;
