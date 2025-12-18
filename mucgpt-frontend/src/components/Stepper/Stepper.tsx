import { ReactElement } from "react";
import styles from "./Stepper.module.css";

export interface Step {
    label: string;
    icon?: ReactElement;
    completedIcon?: ReactElement;
}

interface StepperProps {
    steps: Step[];
    currentStep: number;
    className?: string;
}

export const Stepper = ({ steps, currentStep, className }: StepperProps) => {
    const renderStepNumber = (index: number, step: Step) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = currentStep > stepNumber;

        if (isCompleted && step.completedIcon) {
            return step.completedIcon;
        }

        if (isActive && step.icon) {
            return step.icon;
        }

        if (step.icon && !isCompleted) {
            return step.icon;
        }

        return isCompleted ? "✓" : stepNumber;
    };

    const getStepClassName = (index: number) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = currentStep > stepNumber;
        const isPending = currentStep < stepNumber;

        if (isCompleted) return `${styles.step} ${styles.completedStep}`;
        if (isActive) return `${styles.step} ${styles.activeStep}`;
        if (isPending) return `${styles.step} ${styles.pendingStep}`;
        return styles.step;
    };

    const getConnectorClassName = (index: number) => {
        const stepNumber = index + 1;
        const isCompleted = currentStep > stepNumber;

        if (isCompleted) return `${styles.stepConnector} ${styles.completed}`;
        return styles.stepConnector;
    };

    return (
        <div className={`${styles.stepIndicator} ${className || ""}`}>
            {steps.map((step, index) => (
                <div key={index} className={styles.stepWrapper}>
                    <div className={getStepClassName(index)}>
                        <div className={styles.stepNumber}>{renderStepNumber(index, step)}</div>
                        <div className={styles.stepLabel}>{step.label}</div>
                    </div>
                    {index < steps.length - 1 && <div className={getConnectorClassName(index)}></div>}
                </div>
            ))}
        </div>
    );
};
