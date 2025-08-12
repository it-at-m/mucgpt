import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, Card, CardHeader, CardPreview, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Lightbulb24Regular } from "@fluentui/react-icons";
import styles from "./BaseTutorial.module.css";

export interface TutorialFeature {
    icon: ReactNode;
    title: string;
    description: string;
}

export interface TutorialTip {
    title: string;
    description: string;
    type?: "info" | "warning" | "success";
}

export interface BaseTutorialProps {
    title: string;
    titleIcon: ReactNode;
    description: string;
    features: TutorialFeature[];
    example?: {
        title: string;
        description: string;
        component?: ReactNode;
    };
    technicalDetails?: {
        title: string;
        description: string;
        features?: string[];
        usage?: string[];
    };
    tips: TutorialTip[];
}

export const BaseTutorial: React.FC<BaseTutorialProps> = ({ title, titleIcon, description, features, example, tips }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.tutorial}>
            {/* Introduction */}
            <div className={styles.introSection}>
                <Text as="h3" size={500} weight="semibold" className={styles.sectionTitle}>
                    <div className={styles.tutorialIcon}>{titleIcon}</div>
                    <div>{title}</div>
                </Text>
                <Text className={styles.description}>{description}</Text>
            </div>
            {/* Key Features */}
            {features.length > 0 && (
                <div className={styles.featuresSection}>
                    <Text as="h3" size={500} weight="semibold" className={styles.sectionTitle}>
                        {t("tutorials.features.title", "Hauptfunktionen")}
                    </Text>
                    <div className={styles.featureGrid}>
                        {features.map((feature, index) => (
                            <Card key={index} className={styles.featureCard}>
                                <CardHeader>
                                    <div className={styles.featureIcon}>{feature.icon}</div>
                                    <Text weight="semibold">{feature.title}</Text>
                                </CardHeader>
                                <CardPreview>
                                    <Text className={styles.description}>{feature.description}</Text>
                                </CardPreview>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            {/* Live Example */}
            {example && (
                <div className={styles.exampleSection}>
                    <Text as="h3" size={500} weight="semibold" className={styles.sectionTitle}>
                        {example.title}
                    </Text>
                    <Text className={styles.description}>{example.description}</Text>

                    <div className={styles.exampleContainer}>{example.component && <div style={{ padding: "16px" }}>{example.component}</div>}</div>
                </div>
            )}{" "}
            {/* Tips Section */}
            {tips.length > 0 && (
                <div className={styles.tipsSection}>
                    <Text as="h3" size={500} weight="semibold" className={styles.sectionTitle}>
                        <Lightbulb24Regular className="sectionIcon" />
                        {t("tutorials.tips.title", "Tipps und Best Practices")}
                    </Text>
                    <div className={styles.tipsGrid}>
                        {tips.map((tip, index) => (
                            <MessageBar key={index} intent={tip.type || "info"}>
                                <MessageBarBody>
                                    <Text weight="semibold">{tip.title}</Text>
                                    <br />
                                    <Text>{tip.description}</Text>
                                </MessageBarBody>
                            </MessageBar>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
