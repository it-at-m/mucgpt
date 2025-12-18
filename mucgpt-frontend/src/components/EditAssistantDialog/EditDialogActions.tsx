import React from "react";
import { Button } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import styles from "./EditAssistantDialog.module.css";

interface DialogActionsProps {
    currentStep: number;
    totalSteps: number;
    canProceedToNext: () => boolean;
    onPrevStep: () => void;
    onNextStep: () => void;
    onSave: () => void;
    isOwner: boolean;
}

export const EditDialogActions: React.FC<DialogActionsProps> = ({ currentStep, totalSteps, canProceedToNext, onPrevStep, onNextStep, onSave, isOwner }) => {
    const { t } = useTranslation();

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === totalSteps - 1;

    return (
        <>
            {!isFirstStep && (
                <Button size="medium" onClick={onPrevStep} className={styles.backButton}>
                    {t("common.back")}
                </Button>
            )}
            <Button size="medium" onClick={onSave} className={styles.cancelButton}>
                {!isOwner ? t("components.edit_assistant_dialog.close") : t("components.edit_assistant_dialog.save")}
            </Button>
            {!isLastStep && (
                <Button size="medium" onClick={onNextStep} disabled={!canProceedToNext()} className={styles.continueButton}>
                    {t("components.edit_assistant_dialog.next")}
                </Button>
            )}
        </>
    );
};
