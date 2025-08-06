import React from "react";
import { Button } from "@fluentui/react-components";
import { ChevronLeft24Regular, ChevronRight24Regular, Dismiss24Regular, Save24Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

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

    return (
        <>
            <Button appearance="secondary" size="small" onClick={onPrevStep} disabled={currentStep === 0}>
                <ChevronLeft24Regular /> {t("components.edit_bot_dialog.previous")}
            </Button>
            <Button appearance="secondary" size="small" onClick={onSave}>
                {!isOwner ? <Dismiss24Regular /> : <Save24Filled />} {!isOwner ? t("components.edit_bot_dialog.close") : t("components.edit_bot_dialog.save")}
            </Button>
            <Button appearance="primary" size="small" onClick={onNextStep} disabled={!canProceedToNext() || currentStep === totalSteps - 1}>
                {t("components.edit_bot_dialog.next")} <ChevronRight24Regular />
            </Button>
        </>
    );
};
