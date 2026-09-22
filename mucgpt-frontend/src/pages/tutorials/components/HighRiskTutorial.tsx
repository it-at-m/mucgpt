import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@fluentui/react-components";
import { Apps24Regular, Lightbulb24Regular, ShieldError24Regular, ShieldTask24Regular, Warning24Regular } from "@fluentui/react-icons";

import { WikiTutorial, WikiTutorialSection, wikiAnchor } from "./WikiTutorial";
import { useConfigContext } from "../../../context/ConfigContext";
import styles from "./HighRiskTutorial.module.css";

const EU_AI_ACT_ANNEX_URL = "https://ai-act-law.eu/de/anhang/3/";

const SectionHeading = ({ icon, title }: { icon: ReactNode; title: string }) => (
    <div className={styles.sectionTitle}>
        {icon}
        <h3 className={styles.sectionHeading}>{title}</h3>
    </div>
);

export const HighRiskTutorial = () => {
    const { t } = useTranslation();
    const config = useConfigContext();
    const contactMailUrl = config.contact_mail_url;
    const contactMailLabel = contactMailUrl?.replace(/^mailto:/, "").split("?")[0];

    const relevantAreas = [
        {
            id: "migration",
            emoji: "🛂",
            title: t("tutorials.high_risk.relevant.migration.title", "Migration, Asyl und Grenzkontrolle"),
            description: t(
                "tutorials.high_risk.relevant.migration.description",
                "Assistenten dürfen nicht dazu dienen, Personen im Zusammenhang mit Flucht, Asyl oder Grenzkontrolle zu identifizieren, zu bewerten oder zu überwachen. Auch die Prüfung von Asyl- oder Visumanträgen ist tabu."
            ),
            notAllowed: t(
                "tutorials.high_risk.relevant.migration.not_allowed",
                "Ein Assistent, der Angaben aus einem Asylverfahren auf Glaubwürdigkeit prüft oder Personen an der Grenze identifizieren soll."
            ),
            allowed: t(
                "tutorials.high_risk.relevant.migration.allowed",
                "Ein Assistent, der Textdaten aus gültigen Reisedokumenten strukturiert ausliest, ohne eine Bewertung der Person vorzunehmen."
            )
        },
        {
            id: "services",
            emoji: "🏛️",
            title: t("tutorials.high_risk.relevant.services.title", "Zugang zu öffentlichen Leistungen"),
            description: t(
                "tutorials.high_risk.relevant.services.description",
                "Assistenten dürfen nicht prüfen oder entscheiden, ob eine Person Anspruch auf staatliche Leistungen wie Bürgergeld, Wohngeld oder Gesundheitsdienste hat."
            ),
            notAllowed: t(
                "tutorials.high_risk.relevant.services.not_allowed",
                "Ein Assistent, der anhand von Falldaten bewertet, ob ein Wohngeldantrag bewilligt oder abgelehnt werden soll."
            ),
            allowed: t(
                "tutorials.high_risk.relevant.services.allowed",
                "Ein Assistent, der allgemein erklärt, welche Voraussetzungen für Wohngeld gelten und welche Unterlagen benötigt werden."
            )
        },
        {
            id: "hr",
            emoji: "👥",
            title: t("tutorials.high_risk.relevant.hr.title", "Beschäftigung und Personal"),
            description: t(
                "tutorials.high_risk.relevant.hr.description",
                "Assistenten dürfen Bewerbende oder Beschäftigte nicht automatisiert bewerten, sortieren oder überwachen. Dazu gehören auch Vorschläge für Kündigungen oder Beförderungen."
            ),
            notAllowed: t("tutorials.high_risk.relevant.hr.not_allowed", "Ein Assistent, der Lebensläufe filtert und eine Rangliste der Bewerbenden erstellt."),
            allowed: t(
                "tutorials.high_risk.relevant.hr.allowed",
                "Ein Assistent, der beim Formulieren einer Stellenanzeige oder von Interviewfragen unterstützt."
            )
        },
        {
            id: "education",
            emoji: "🎓",
            title: t("tutorials.high_risk.relevant.education.title", "Bildung und Berufsbildung"),
            description: t(
                "tutorials.high_risk.relevant.education.description",
                "Assistenten dürfen nicht über Zulassungen entscheiden, keine finalen Noten vergeben und das Bildungsniveau einer Person nicht einstufen."
            ),
            notAllowed: t(
                "tutorials.high_risk.relevant.education.not_allowed",
                "Ein Assistent, der Prüfungen abschließend benotet oder entscheidet, ob ein Kind für das Gymnasium geeignet ist."
            ),
            allowed: t(
                "tutorials.high_risk.relevant.education.allowed",
                "Ein Assistent, der als Lernhilfe Fehler markiert und Verbesserungsvorschläge macht, ohne verbindlich zu bewerten."
            )
        }
    ];

    const otherAreas = [
        {
            id: "biometrics",
            emoji: "👁️",
            title: t("tutorials.high_risk.other.biometrics.title", "Biometrie"),
            description: t(
                "tutorials.high_risk.other.biometrics.description",
                "Fernidentifizierung von Personen, Kategorisierung nach sensiblen Merkmalen und Emotionserkennung."
            )
        },
        {
            id: "infrastructure",
            emoji: "⚡",
            title: t("tutorials.high_risk.other.infrastructure.title", "Kritische Infrastruktur"),
            description: t(
                "tutorials.high_risk.other.infrastructure.description",
                "KI als Sicherheitsbauteil für Strom-, Wasser-, Gas- und Wärmeversorgung, Straßenverkehr oder kritische digitale Infrastruktur."
            )
        },
        {
            id: "law_enforcement",
            emoji: "🚔",
            title: t("tutorials.high_risk.other.law_enforcement.title", "Strafverfolgung"),
            description: t(
                "tutorials.high_risk.other.law_enforcement.description",
                "Einschätzung von Straftat-Risiken, Lügendetektoren und die Bewertung von Beweismitteln."
            )
        },
        {
            id: "justice",
            emoji: "⚖️",
            title: t("tutorials.high_risk.other.justice.title", "Rechtspflege und Wahlen"),
            description: t(
                "tutorials.high_risk.other.justice.description",
                "Unterstützung von Gerichten bei der Auslegung und Anwendung von Recht sowie die Beeinflussung von Wahlen."
            )
        },
        {
            id: "essential_services",
            emoji: "💳",
            title: t("tutorials.high_risk.other.essential_services.title", "Private Basisleistungen und Notdienste"),
            description: t(
                "tutorials.high_risk.other.essential_services.description",
                "Kreditwürdigkeitsprüfung, Risikobewertung bei Lebens- und Krankenversicherungen sowie die Klassifizierung und Priorisierung von Notrufen."
            )
        }
    ];

    const checkSteps = [
        t("tutorials.high_risk.check.step1", "Lesen Sie Ihren System-Prompt noch einmal aufmerksam durch."),
        t("tutorials.high_risk.check.step2", "Überlegen Sie, ob Ihr Assistent in einen der beschriebenen Bereiche fällt."),
        t("tutorials.high_risk.check.step3", "Passen Sie den Prompt an, wenn er eine kritische Aufgabe beschreibt oder missverständlich formuliert ist."),
        t("tutorials.high_risk.check.step4", "Sind Sie unsicher, wenden Sie sich an die Verantwortlichen für MUCGPT.")
    ];

    const tips = [
        {
            title: t("tutorials.high_risk.tips.no_decisions.title", "Keine Entscheidungen über Menschen"),
            description: t(
                "tutorials.high_risk.tips.no_decisions.description",
                "Assistenten dürfen Menschen in sensiblen Lebensbereichen nicht bewerten, einstufen oder über sie entscheiden. Auch automatisierte Vorschläge, etwa eine Rangliste von Bewerbungen, zählen dazu."
            )
        },
        {
            title: t("tutorials.high_risk.tips.orientation.title", "Die Prüfung ist nur eine Orientierung"),
            description: t(
                "tutorials.high_risk.tips.orientation.description",
                "Der automatische Check ersetzt keine rechtliche Bewertung. Die Verantwortung für den Assistenten bleibt bei Ihnen."
            )
        },
        {
            title: t("tutorials.high_risk.tips.contact.title", "Im Zweifel nachfragen"),
            description: t(
                "tutorials.high_risk.tips.contact.description",
                "Wenn Sie unsicher sind, ob Ihr Assistent ein Hochrisiko-System sein könnte, melden Sie sich bei den Verantwortlichen für MUCGPT."
            )
        }
    ];

    const sections: WikiTutorialSection[] = [
        {
            id: "intro",
            title: t("tutorials.high_risk.sections.titles.intro", "Einführung"),
            content: (
                <div>
                    <SectionHeading
                        icon={<ShieldError24Regular className={styles.sectionIcon} />}
                        title={t("tutorials.high_risk.intro.title", "Was sind Hochrisiko-KI-Systeme?")}
                    />
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.intro.description",
                            "Die EU regelt mit dem AI Act (EU-KI-Verordnung), wie Künstliche Intelligenz eingesetzt werden darf. Als Hochrisiko gelten KI-Systeme, die wichtige Entscheidungen über Menschen treffen oder vorbereiten, etwa über Sozialleistungen, Jobs oder Bildungswege. Solche Systeme unterliegen strengen Auflagen, die MUCGPT nicht erfüllt. Deshalb dürfen Assistenten in MUCGPT keine Hochrisiko-Aufgaben übernehmen."
                        )}
                    </p>
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.overview.description",
                            "Der Anhang III des AI Acts benennt acht Bereiche. Vier davon sind für die Arbeit mit MUCGPT besonders relevant, die übrigen stellen wir kurz vor."
                        )}
                    </p>
                </div>
            )
        },
        {
            id: "relevant",
            title: t("tutorials.high_risk.sections.titles.relevant", "Wichtige Bereiche"),
            subsections: relevantAreas.map(area => ({ id: area.id, title: area.title })),
            content: (
                <div>
                    <SectionHeading
                        icon={<Warning24Regular className={styles.sectionIcon} />}
                        title={t("tutorials.high_risk.relevant.title", "Diese vier Bereiche sind für MUCGPT besonders wichtig")}
                    />
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.relevant.description",
                            "In diesen Bereichen könnten Assistenten am ehesten versehentlich zu einem Hochrisiko-System werden. Schauen Sie hier besonders genau hin."
                        )}
                    </p>
                    {relevantAreas.map(area => (
                        <div key={area.id} id={wikiAnchor(area.id)} className={styles.areaCard}>
                            <h4 className={styles.areaTitle}>
                                <span className={styles.areaEmoji}>{area.emoji}</span>
                                {area.title}
                            </h4>
                            <p className={styles.paragraph}>{area.description}</p>
                            <div className={`${styles.exampleRow} ${styles.exampleNotAllowed}`}>
                                <p className={styles.exampleText}>
                                    <strong>{t("tutorials.high_risk.relevant.not_allowed_label", "Nicht erlaubt:")}</strong> {area.notAllowed}
                                </p>
                            </div>
                            <div className={`${styles.exampleRow} ${styles.exampleAllowed}`}>
                                <p className={styles.exampleText}>
                                    <strong>{t("tutorials.high_risk.relevant.allowed_label", "Erlaubt:")}</strong> {area.allowed}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
        {
            id: "other",
            title: t("tutorials.high_risk.sections.titles.other", "Weitere Bereiche"),
            content: (
                <div>
                    <SectionHeading
                        icon={<Apps24Regular className={styles.sectionIcon} />}
                        title={t("tutorials.high_risk.other.title", "Weitere Hochrisiko-Bereiche im Überblick")}
                    />
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.other.description",
                            "Der AI Act benennt außerdem diese Bereiche. Sie spielen in MUCGPT kaum eine Rolle, weil das System zum Beispiel keine biometrischen Daten verarbeitet und keine Infrastruktur steuert. Entsprechende Anwendungsfälle sind trotzdem nicht erlaubt."
                        )}
                    </p>
                    <div className={styles.conceptGrid}>
                        {otherAreas.map(area => (
                            <div key={area.id} className={styles.conceptCard}>
                                <h4 className={styles.areaTitle}>
                                    <span className={styles.areaEmoji}>{area.emoji}</span>
                                    {area.title}
                                </h4>
                                <p className={styles.conceptDescription}>{area.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: "check",
            title: t("tutorials.high_risk.sections.titles.check", "Automatische Prüfung"),
            content: (
                <div>
                    <SectionHeading
                        icon={<ShieldTask24Regular className={styles.sectionIcon} />}
                        title={t("tutorials.high_risk.check.title", "Die automatische Prüfung im Assistenten-Editor")}
                    />
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.check.description",
                            "Wenn Sie einen eigenen Assistenten erstellen oder bearbeiten, prüft MUCGPT den System-Prompt vor dem Speichern automatisch auf Hinweise auf die vier oben beschriebenen Bereiche. Das Ergebnis sehen Sie direkt im Editor."
                        )}
                    </p>
                    <div className={styles.highlightBox}>
                        <p className={styles.exampleText}>
                            <strong>{t("tutorials.high_risk.check.disclaimer_title", "Wichtig:")}</strong>{" "}
                            {t(
                                "tutorials.high_risk.check.disclaimer",
                                "Die Prüfung ist eine Orientierungshilfe und keine rechtliche oder abschließende Bewertung. Sie kann Hinweise übersehen oder auch einmal zu vorsichtig sein."
                            )}
                        </p>
                    </div>
                    <p className={styles.stepsTitle}>{t("tutorials.high_risk.check.steps_title", "Wenn die Prüfung einen Hinweis ausspielt:")}</p>
                    <ol className={styles.checkList}>
                        {checkSteps.map((step, index) => (
                            <li key={index}>{step}</li>
                        ))}
                    </ol>
                    <p className={styles.paragraph}>
                        {t(
                            "tutorials.high_risk.check.outro",
                            "Auch ohne Hinweis bleiben Sie selbst verantwortlich: Beim Speichern bestätigen Sie, dass Ihr Assistent kein Hochrisiko-System ist."
                        )}
                    </p>
                </div>
            )
        },
        {
            id: "conclusion",
            title: t("tutorials.high_risk.sections.titles.conclusion", "Das Wichtigste"),
            content: (
                <div>
                    <SectionHeading
                        icon={<Lightbulb24Regular className={styles.sectionIcon} />}
                        title={t("tutorials.high_risk.sections.titles.conclusion", "Das Wichtigste")}
                    />
                    <div className={styles.tipsContainer}>
                        {tips.map((tip, index) => (
                            <div key={index} className={styles.tipItem}>
                                <strong>{tip.title}</strong>
                                <p>{tip.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: "links",
            title: t("tutorials.high_risk.links.title", "Weiterführende Links"),
            hideFromToc: true,
            content: (
                <div>
                    <SectionHeading icon={<span className={styles.emojiIcon}>🔗</span>} title={t("tutorials.high_risk.links.title", "Weiterführende Links")} />
                    <ul className={styles.linksList}>
                        <li>
                            <Link href={EU_AI_ACT_ANNEX_URL} target="_blank" rel="noopener noreferrer">
                                {t("tutorials.high_risk.links.eu_ai_act", "EU AI Act, Anhang III: Hochrisiko-KI-Systeme")}
                            </Link>
                        </li>
                        {contactMailUrl && (
                            <li>
                                {t("tutorials.high_risk.links.contact", "Fragen oder unsicher? Schreiben Sie uns:")}{" "}
                                <Link href={contactMailUrl}>{contactMailLabel}</Link>
                            </li>
                        )}
                    </ul>
                </div>
            )
        }
    ];

    return <WikiTutorial tocTitle={t("tutorials.high_risk.toc_title", "Auf dieser Seite")} sections={sections} />;
};

export default HighRiskTutorial;
