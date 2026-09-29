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
            id: "education",
            emoji: "🎓",
            title: t("tutorials.high_risk.relevant.education.title"),
            description: t("tutorials.high_risk.relevant.education.description"),
            notAllowed: t("tutorials.high_risk.relevant.education.not_allowed")
        },

        {
            id: "hr",
            emoji: "👥",
            title: t("tutorials.high_risk.relevant.hr.title"),
            description: t("tutorials.high_risk.relevant.hr.description"),
            notAllowed: t("tutorials.high_risk.relevant.hr.not_allowed")
        },

        {
            id: "services",
            emoji: "🏛️",
            title: t("tutorials.high_risk.relevant.services.title"),
            description: t("tutorials.high_risk.relevant.services.description"),
            notAllowed: t("tutorials.high_risk.relevant.services.not_allowed")
        },
        {
            id: "migration",
            emoji: "🛂",
            title: t("tutorials.high_risk.relevant.migration.title"),
            description: t("tutorials.high_risk.relevant.migration.description"),
            notAllowed: t("tutorials.high_risk.relevant.migration.not_allowed")
        }
    ];

    const otherAreas = [
        {
            id: "biometrics",
            emoji: "👁️",
            title: t("tutorials.high_risk.other.biometrics.title", "Biometrie"),
            description: t("tutorials.high_risk.other.biometrics.description")
        },
        {
            id: "infrastructure",
            emoji: "⚡",
            title: t("tutorials.high_risk.other.infrastructure.title", "Kritische Infrastruktur"),
            description: t("tutorials.high_risk.other.infrastructure.description")
        },
        {
            id: "law_enforcement",
            emoji: "🚔",
            title: t("tutorials.high_risk.other.law_enforcement.title", "Strafverfolgung"),
            description: t("tutorials.high_risk.other.law_enforcement.description")
        },
        {
            id: "justice",
            emoji: "⚖️",
            title: t("tutorials.high_risk.other.justice.title", "Rechtspflege und Wahlen"),
            description: t("tutorials.high_risk.other.justice.description")
        }
    ];

    const checkSteps = [
        t("tutorials.high_risk.check.step1"),
        t("tutorials.high_risk.check.step2"),
        t("tutorials.high_risk.check.step3"),
        t("tutorials.high_risk.check.step4")
    ];

    const tips = [
        {
            title: t("tutorials.high_risk.tips.no_decisions.title"),
            description: t("tutorials.high_risk.tips.no_decisions.description")
        },
        {
            title: t("tutorials.high_risk.tips.orientation.title"),
            description: t("tutorials.high_risk.tips.orientation.description")
        },
        {
            title: t("tutorials.high_risk.tips.contact.title"),
            description: t("tutorials.high_risk.tips.contact.description")
        }
    ];

    const sections: WikiTutorialSection[] = [
        {
            id: "intro",
            title: t("tutorials.high_risk.sections.titles.intro"),
            content: (
                <div>
                    <SectionHeading icon={<ShieldError24Regular className={styles.sectionIcon} />} title={t("tutorials.high_risk.intro.title")} />
                    <p className={styles.paragraph}>{t("tutorials.high_risk.intro.description")}</p>
                    <p className={styles.paragraph}>{t("tutorials.high_risk.overview.description")}</p>
                </div>
            )
        },
        {
            id: "relevant",
            title: t("tutorials.high_risk.sections.titles.relevant"),
            subsections: relevantAreas.map(area => ({ id: area.id, title: area.title })),
            content: (
                <div>
                    <SectionHeading icon={<Warning24Regular className={styles.sectionIcon} />} title={t("tutorials.high_risk.relevant.title")} />
                    <p className={styles.paragraph}>{t("tutorials.high_risk.relevant.description")}</p>
                    {relevantAreas.map(area => (
                        <div key={area.id} id={wikiAnchor(area.id)} className={styles.areaCard}>
                            <h4 className={styles.areaTitle}>
                                <span className={styles.areaEmoji}>{area.emoji}</span>
                                {area.title}
                            </h4>
                            <p className={styles.paragraph}>{area.description}</p>
                            <div className={`${styles.exampleRow} ${styles.exampleNotAllowed}`}>
                                <p className={styles.exampleText}>
                                    <strong>{t("tutorials.high_risk.relevant.not_allowed_label")}</strong> {area.notAllowed}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
        {
            id: "other",
            title: t("tutorials.high_risk.sections.titles.other"),
            content: (
                <div>
                    <SectionHeading icon={<Apps24Regular className={styles.sectionIcon} />} title={t("tutorials.high_risk.other.title")} />
                    <p className={styles.paragraph}>{t("tutorials.high_risk.other.description")}</p>
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
            title: t("tutorials.high_risk.sections.titles.check"),
            content: (
                <div>
                    <SectionHeading icon={<ShieldTask24Regular className={styles.sectionIcon} />} title={t("tutorials.high_risk.check.title")} />
                    <p className={styles.paragraph}>{t("tutorials.high_risk.check.description")}</p>
                    <div className={styles.highlightBox}>
                        <p className={styles.exampleText}>
                            <strong>{t("tutorials.high_risk.check.disclaimer_title")}</strong> {t("tutorials.high_risk.check.disclaimer")}
                        </p>
                    </div>
                    <p className={styles.stepsTitle}>{t("tutorials.high_risk.check.steps_title")}</p>
                    <ol className={styles.checkList}>
                        {checkSteps.map((step, index) => (
                            <li key={index}>{step}</li>
                        ))}
                    </ol>
                    <p className={styles.paragraph}>{t("tutorials.high_risk.check.outro")}</p>
                </div>
            )
        },
        {
            id: "conclusion",
            title: t("tutorials.high_risk.sections.titles.conclusion"),
            content: (
                <div>
                    <SectionHeading icon={<Lightbulb24Regular className={styles.sectionIcon} />} title={t("tutorials.high_risk.sections.titles.conclusion")} />
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
            title: t("tutorials.high_risk.links.title"),
            hideFromToc: true,
            content: (
                <div>
                    <SectionHeading icon={<span className={styles.emojiIcon}>🔗</span>} title={t("tutorials.high_risk.links.title")} />
                    <ul className={styles.linksList}>
                        <li>
                            <Link href={EU_AI_ACT_ANNEX_URL} target="_blank" rel="noopener noreferrer">
                                {t("tutorials.high_risk.links.eu_ai_act")}
                            </Link>
                        </li>
                        {contactMailUrl && (
                            <li>
                                {t("tutorials.high_risk.links.contact")} <Link href={contactMailUrl}>{contactMailLabel}</Link>
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
