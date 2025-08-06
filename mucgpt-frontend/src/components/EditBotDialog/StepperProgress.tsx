import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./EditBotDialog.module.css";

interface StepperProgressProps {
    currentStep: number;
    totalSteps: number;
    stepTitles: string[];
}

export const StepperProgress: React.FC<StepperProgressProps> = ({ currentStep, totalSteps, stepTitles }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.stepperContainer}>
            <div className={styles.stepperHeader}>
                <div className={styles.stepNumber}>
                    {currentStep + 1} / {totalSteps}
                </div>
                <div className={styles.stepTitle}>{t(stepTitles[currentStep])}</div>
            </div>
            <div className={styles.progressBar}>
                <div
                    className={styles.progressFill}
                    style={
                        {
                            "--progress-width": `${((currentStep + 1) / totalSteps) * 100}%`
                        } as React.CSSProperties
                    }
                />
            </div>
        </div>
    );
};
