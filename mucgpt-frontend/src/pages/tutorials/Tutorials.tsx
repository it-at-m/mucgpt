import { useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Tooltip, Card, CardHeader, Text, Badge, Divider } from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Book24Regular,
    BrainCircuit24Regular,
    TextBulletListSquare24Regular,
    Play24Regular,
    Toolbox24Regular,
    Lightbulb24Regular,
    ChevronRight16Regular,
    Bot24Regular,
    ShieldError24Regular,
    Apps24Regular
} from "@fluentui/react-icons";
import styles from "./Tutorials.module.css";
import { BrainstormTutorial } from "./components/BrainstormTutorial";
import { SimplifyTutorial } from "./components/SimplifyTutorial";
import { ToolsTutorial } from "./components/ToolsTutorial";
import { AIBasicsTutorial } from "./components/AIBasicsTutorial";

interface TutorialSection {
    id: string;
    title: string;
    description: string;
    icon: JSX.Element;
    badge?: string;
    component: JSX.Element;
}

interface TutorialSectionGroup {
    title: string;
    description: string;
    tutorials: TutorialSection[];
}

export const Tutorials = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Get current tutorial from URL path
    const currentTutorial = location.pathname.includes("/tutorials/") ? location.pathname.split("/tutorials/")[1] : null;

    const onClose = useCallback(() => {
        navigate("/");
    }, [navigate]);

    const handleNavigateToTutorial = useCallback(
        (tutorialId: string) => {
            navigate(`/tutorials/${tutorialId}`);
        },
        [navigate]
    );
    const handleTutorialSelect = useCallback(
        (tutorialId: string) => {
            navigate(`/tutorials/${tutorialId}`);
        },
        [navigate]
    );

    // Check if tutorial is under construction
    const isTutorialUnderConstruction = useCallback(
        (tutorial: TutorialSection) => {
            return tutorial.badge === t("tutorials.badges.in_construction", "Im Aufbau");
        },
        [t]
    );
    const tutorialSections = useMemo(
        (): Record<string, TutorialSectionGroup> => ({
            "ki-background": {
                title: t("tutorials.sections.ki_background.title", "KI Background"),
                description: t("tutorials.sections.ki_background.description", "Grundlagen und Hintergründe zu Künstlicher Intelligenz"),
                tutorials: [
                    {
                        id: "ki-basics",
                        title: t("tutorials.ki_basics.title", "KI-Grundlagen"),
                        description: t("tutorials.ki_basics.description", "Was ist KI und wie funktioniert sie? Verstehe die Grundlagen moderner AI-Systeme."),
                        icon: <BrainCircuit24Regular />,
                        badge: t("tutorials.badges.new", "Neu"),
                        component: <AIBasicsTutorial />
                    },
                    {
                        id: "prompt-engineering",
                        title: t("tutorials.prompt_engineering.title", "Prompt Engineering"),
                        description: t("tutorials.prompt_engineering.description", "Lerne, wie du effektive Prompts schreibst für bessere KI-Antworten."),
                        icon: <TextBulletListSquare24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>Prompt Engineering Tutorial coming soon...</div>
                    },
                    {
                        id: "ai-agents",
                        title: t("tutorials.ai_agents.title", "KI-Agenten"),
                        description: t(
                            "tutorials.ai_agents.description",
                            "Verstehe, wie KI-Agenten funktionieren und interagieren. Lerne die Grundlagen autonomer KI-Systeme."
                        ),
                        icon: <Bot24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>KI-Agenten Tutorial coming soon...</div>
                    },
                    {
                        id: "ai-limitations",
                        title: t("tutorials.ai_limitations.title", "KI-Limitierungen"),
                        description: t(
                            "tutorials.ai_limitations.description",
                            "Erkenne die Grenzen von KI-Systemen und lerne, wie du realistische Erwartungen setzt."
                        ),
                        icon: <ShieldError24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>KI-Limitierungen Tutorial coming soon...</div>
                    },
                    {
                        id: "ai-applications",
                        title: t("tutorials.ai_applications.title", "KI-Anwendungsgebiete"),
                        description: t(
                            "tutorials.ai_applications.description",
                            "Entdecke die vielfältigen Einsatzmöglichkeiten von KI in verschiedenen Bereichen."
                        ),
                        icon: <Apps24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>KI-Anwendungsgebiete Tutorial coming soon...</div>
                    }
                ]
            },
            tools: {
                title: t("tutorials.sections.tools.title", "Werkzeuge"),
                description: t("tutorials.sections.tools.description", "Praktische Anleitungen für die verschiedenen MUCGPT-Werkzeuge"),
                tutorials: [
                    {
                        id: "tools",
                        title: t("tutorials.tools.title", "KI-Werkzeuge Übersicht"),
                        description: t("tutorials.tools.description", "Erfahre, wie du verschiedene AI-Tools effektiv einsetzt und kombinierst."),
                        badge: t("tutorials.badges.popular", "Neu"),
                        icon: <Toolbox24Regular />,
                        component: <ToolsTutorial onNavigateToTutorial={handleNavigateToTutorial} />
                    },
                    {
                        id: "brainstorm",
                        title: t("tutorials.brainstorm.title", "Brainstorming Werkzeug"),
                        description: t(
                            "tutorials.brainstorm.description",
                            "Lerne, wie du mit dem Brainstorming-Tool kreative Mindmaps erstellen und strukturieren kannst."
                        ),
                        icon: <BrainCircuit24Regular />,
                        badge: t("tutorials.badges.popular", "Neu"),
                        component: <BrainstormTutorial />
                    },
                    {
                        id: "simplify",
                        title: t("tutorials.simplify.title", "Text-Vereinfachung Werkzeug"),
                        description: t("tutorials.simplify.description", "Erfahre, wie du komplexe Texte in verständliche Leichte Sprache übersetzt."),
                        icon: <TextBulletListSquare24Regular />,
                        badge: t("tutorials.badges.new", "Neu"),
                        component: <SimplifyTutorial />
                    }
                ]
            },
            "general-tips": {
                title: t("tutorials.sections.general_tips.title", "Allgemeine Tipps"),
                description: t("tutorials.sections.general_tips.description", "Tipps und Best Practices für die optimale Nutzung von MUCGPT"),
                tutorials: [
                    {
                        id: "best-practices",
                        title: t("tutorials.best_practices.title", "Best Practices"),
                        description: t("tutorials.best_practices.description", "Bewährte Methoden für eine effektive Nutzung der KI-Assistenten."),
                        icon: <Lightbulb24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>Best Practices Tutorial coming soon...</div>
                    },
                    {
                        id: "productivity-tips",
                        title: t("tutorials.productivity_tips.title", "Produktivitäts-Tipps"),
                        description: t("tutorials.productivity_tips.description", "Steigere deine Produktivität mit cleveren Tricks und Shortcuts."),
                        icon: <Play24Regular />,
                        badge: t("tutorials.badges.in_construction", "Im Aufbau"),
                        component: <div>Produktivitäts-Tipps Tutorial coming soon...</div>
                    }
                ]
            }
        }),
        [t, handleNavigateToTutorial]
    );

    // Flatten all tutorials for navigation
    const allTutorials = useMemo(() => {
        const tutorials: TutorialSection[] = [];
        Object.values(tutorialSections).forEach(section => {
            tutorials.push(...section.tutorials);
        });
        return tutorials;
    }, [tutorialSections]); // Render tutorial overview with sections
    const renderOverview = () => (
        <div className={styles.tutorialSections}>
            {Object.entries(tutorialSections).map(([sectionId, section]) => (
                <div key={sectionId} className={styles.tutorialSection}>
                    <div className={styles.sectionHeader}>
                        <Text as="h3" size={500} weight="semibold">
                            {section.title}
                        </Text>
                        <Text size={300} className={styles.sectionDescription}>
                            {section.description}
                        </Text>
                    </div>

                    <div className={styles.tutorialGrid}>
                        {section.tutorials.map(tutorial => {
                            const isUnderConstruction = isTutorialUnderConstruction(tutorial);

                            return (
                                <Card
                                    key={tutorial.id}
                                    className={`${styles.tutorialCard} ${isUnderConstruction ? styles.disabledCard : ""}`}
                                    onClick={!isUnderConstruction ? () => handleTutorialSelect(tutorial.id) : undefined}
                                    tabIndex={!isUnderConstruction ? 0 : -1}
                                    role="button"
                                    aria-label={`${tutorial.title} - ${tutorial.description}`}
                                    style={{
                                        cursor: isUnderConstruction ? "not-allowed" : "pointer",
                                        opacity: isUnderConstruction ? 0.6 : 1
                                    }}
                                >
                                    <CardHeader
                                        image={<div className={styles.tutorialIcon}>{tutorial.icon}</div>}
                                        header={
                                            <div className={styles.tutorialHeader}>
                                                <Text weight="semibold" size={400}>
                                                    {tutorial.title}
                                                </Text>
                                                {tutorial.badge && (
                                                    <Badge appearance={isUnderConstruction ? "outline" : "tint"} size="small">
                                                        {tutorial.badge}
                                                    </Badge>
                                                )}
                                            </div>
                                        }
                                        description={
                                            <Text size={300} className={styles.tutorialDescription}>
                                                {tutorial.description}
                                            </Text>
                                        }
                                        action={!isUnderConstruction ? <Button appearance="transparent" icon={<ChevronRight16Regular />} size="small" /> : null}
                                    />
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    ); // Render selected tutorial
    const renderSelectedTutorial = () => {
        const tutorial = allTutorials.find(t => t.id === currentTutorial);
        if (!tutorial) return null;

        return (
            <div className={styles.tutorialContent}>
                <div className={styles.tutorialBreadcrumb}>
                    <Button appearance="subtle" onClick={() => navigate("/tutorials")} size="small">
                        ← {t("tutorials.back_to_overview", "Zurück zur Übersicht")}
                    </Button>
                </div>

                <div className={styles.tutorialHeader}>
                    <div className={styles.tutorialTitleContainer}>
                        <div className={styles.tutorialIcon}>{tutorial.icon}</div>
                        <div>
                            <Text as="h2" size={600} weight="semibold">
                                {tutorial.title}
                            </Text>
                            <Text size={400} className={styles.tutorialSubtitle}>
                                {tutorial.description}
                            </Text>
                        </div>
                    </div>
                    {tutorial.badge && <Badge appearance="tint">{tutorial.badge}</Badge>}
                </div>

                <Divider />

                <div className={styles.tutorialBody}>{tutorial.component}</div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerContainer}>
                <div className={styles.titleSection}>
                    <Book24Regular className={styles.pageIcon} />
                    <div>
                        <Text as="h1" size={700} weight="bold">
                            {t("tutorials.title", "Anleitungen")}
                        </Text>
                        <Text size={400} className={styles.subtitle}>
                            {t("tutorials.subtitle", "Lerne, wie MUCGPT funktioniert")}
                        </Text>
                    </div>
                </div>

                <Tooltip content={t("common.close")} relationship="description" positioning="below">
                    <Button aria-label={t("common.close")} icon={<Dismiss24Regular />} appearance="subtle" onClick={onClose} size="large" />
                </Tooltip>
            </div>{" "}
            <div className={styles.content}>{currentTutorial ? renderSelectedTutorial() : renderOverview()}</div>
        </div>
    );
};

export default Tutorials;
