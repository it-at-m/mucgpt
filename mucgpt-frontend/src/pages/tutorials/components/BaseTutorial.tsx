import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@fluentui/react-components";
import { Lightbulb24Regular } from "@fluentui/react-icons";
import styles from "./BaseTutorial.module.css";

export interface TutorialTip {
    title: string;
    description: string;
    type?: "info" | "warning" | "success";
}

export interface BaseTutorialProps {
    title: string;
    titleIcon: ReactNode;
    description: string;
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

export const BaseTutorial: React.FC<BaseTutorialProps> = ({ title, titleIcon, description, example, tips }) => {
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
            {/* Live Example */}
            {example && (
                <div className={styles.exampleSection}>
                    <div className={styles.sectionTitle}>
                        <span className={styles.sectionIcon}>💡</span>
                        <Text as="h3" size={500} weight="semibold">
                            {example.title}
                        </Text>
                    </div>
                    <Text className={styles.description}>{example.description}</Text>

                    <div className={styles.exampleContainer}>{example.component && <div style={{ padding: "16px" }}>{example.component}</div>}</div>
                </div>
            )}{" "}
            {/* Tips Section */}
            {tips.length > 0 && (
                <div className={styles.tipsSection}>
                    <div className={styles.sectionTitle}>
                        <Lightbulb24Regular className={styles.sectionIcon} />
                        <Text as="h3" size={500} weight="semibold">
                            {t("tutorials.tips.title", "Tipps und Best Practices")}
                        </Text>
                    </div>
                    <div className={styles.tipsContainer}>
                        {tips.map((tip, index) => (
                            <div key={index} className={styles.tipItem}>
                                <strong>{tip.title}</strong>
                                <p>{tip.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
