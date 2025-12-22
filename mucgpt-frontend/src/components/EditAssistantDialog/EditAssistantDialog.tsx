import { Dismiss24Regular } from "@fluentui/react-icons";
import { Dialog, DialogActions, DialogBody, DialogSurface, DialogTitle, Button } from "@fluentui/react-components";

import styles from "./EditAssistantDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useState, useMemo, useEffect } from "react";
import { Assistant, ToolInfo } from "../../api";
import { StepperProgress } from "./StepperProgress";
import { EditDialogActions } from "./EditDialogActions";
import { useAssistantState } from "./useAssistantState";
import { TitleStep, DescriptionStep, SystemPromptStep, ToolsStep, QuickPromptsStep, ExamplesStep, AdvancedSettingsStep } from "./steps";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import { AssistantStrategy } from "../../pages/assistant/AssistantStrategy";
import { VisibilityStep } from "./steps/VisibilityStep";
import { useToolsContext } from "../ToolsProvider";

interface Props {
    showDialog: boolean;
    setShowDialog: (showDialog: boolean) => void;
    assistant: Assistant;
    onAssistantChanged: (assistant: Assistant) => void;
    isOwner: boolean;
    strategy: AssistantStrategy;
}

export const EditAssistantDialog = ({ showDialog, setShowDialog, assistant, onAssistantChanged, isOwner, strategy }: Props) => {
    // Toast setup
    const { showSuccess } = useGlobalToastContext();

    // Stepper state
    const [currentStep, setCurrentStep] = useState<number>(0);

    const assistantState = useAssistantState(assistant);
    const { title, description, systemPrompt, quickPrompts, examples, temperature, maxOutputTokens, tools, publish, hierarchicalAccess, isVisible } =
        assistantState;

    // Conditionally adjust steps based on publish status
    const totalSteps = publish ? 8 : 7;
    const stepTitles = publish
        ? [
            "components.edit_assistant_dialog.step_title",
            "components.edit_assistant_dialog.step_description",
            "components.edit_assistant_dialog.step_system_prompt",
            "components.edit_assistant_dialog.step_tools",
            "components.edit_assistant_dialog.step_quick_prompts",
            "components.edit_assistant_dialog.step_examples",
            "components.edit_assistant_dialog.step_visibility",
            "components.edit_assistant_dialog.step_advanced_settings"
        ]
        : [
            "components.edit_assistant_dialog.step_title",
            "components.edit_assistant_dialog.step_description",
            "components.edit_assistant_dialog.step_system_prompt",
            "components.edit_assistant_dialog.step_tools",
            "components.edit_assistant_dialog.step_quick_prompts",
            "components.edit_assistant_dialog.step_examples",
            "components.edit_assistant_dialog.step_advanced_settings"
        ];

    const [closeDialogOpen, setCloseDialogOpen] = useState<boolean>(false);

    const { t } = useTranslation();
    const { tools: availableTools } = useToolsContext();

    const selectedTools = useMemo(() => {
        if (!availableTools) {
            return [] as ToolInfo[];
        }

        const toolMap = new Map(availableTools.tools.map(tool => [tool.id, tool]));
        return tools.map(tool => toolMap.get(tool.id)).filter(Boolean) as ToolInfo[];
    }, [availableTools, tools]);

    useEffect(() => {
        if (!showDialog) {
            setCurrentStep(0);
        }
    }, [showDialog]);

    // Stepper navigation functions
    const nextStep = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const canProceedToNext = () => {
        switch (currentStep) {
            case 0: // Title
                return title.trim() !== "";
            case 1: // Description
                return description.trim() !== "";
            case 2: // System prompt
                return systemPrompt.trim() !== "";
            default:
                return true; // Tools, quick prompts, examples, and advanced settings are optional
        }
    };

    // save assistant
    const onSaveButtonClicked = useCallback(async () => {
        if (!isOwner && !assistantState.assistantId) {
            setShowDialog(false);
            return;
        }
        const newAssistant = assistantState.createAssistantForSaving();
        await onAssistantChanged(newAssistant);
        setCurrentStep(0);

        // Show success toast
        if (isOwner)
            showSuccess(
                t("components.edit_assistant_dialog.saved_successfully"),
                t("components.edit_assistant_dialog.assistant_saved_description", { assistantName: newAssistant.title })
            );

        // For owned community assistants, reload the page to ensure latest version is fetched
        if (strategy.requiresReloadOnSave) {
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            // Close dialog after a short delay for local assistants
            setTimeout(() => {
                setShowDialog(false);
            }, 500);
        }
    }, [isOwner, assistantState, onAssistantChanged, showSuccess, t, setShowDialog, strategy]);

    // close dialog pressed function
    const closeDialogPressed = useCallback(() => {
        setCloseDialogOpen(false);
        setShowDialog(false);
        setCurrentStep(0);
        assistantState.resetToOriginal();
    }, [setShowDialog, assistantState]);

    // close dialog
    const closeDialog = useMemo(() => {
        return (
            <Dialog modalType="alert" open={closeDialogOpen} onOpenChange={(_event, data) => setCloseDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogTitle>{t("components.edit_assistant_dialog.close_dialog_title")}</DialogTitle>
                    <DialogBody>{t("components.edit_assistant_dialog.close_dialog_message")}</DialogBody>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setCloseDialogOpen(false)}>
                            {t("components.edit_assistant_dialog.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={closeDialogPressed}>
                            {t("components.edit_assistant_dialog.close")}
                        </Button>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
        );
    }, [closeDialogOpen, t, closeDialogPressed]);

    // Function to render current step content
    const getCurrentStepContent = useMemo(() => {
        switch (currentStep) {
            case 0:
                return <TitleStep title={title} isOwner={isOwner} onTitleChange={assistantState.updateTitle} onHasChanged={assistantState.setHasChanged} />;
            case 1:
                return (
                    <DescriptionStep
                        description={description}
                        isOwner={isOwner}
                        onDescriptionChange={assistantState.updateDescription}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 2:
                return (
                    <SystemPromptStep
                        systemPrompt={systemPrompt}
                        isOwner={isOwner}
                        onSystemPromptChange={assistantState.updateSystemPrompt}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 3:
                return (
                    <ToolsStep
                        tools={tools}
                        selectedTools={selectedTools}
                        availableTools={availableTools}
                        onToolsChange={assistantState.updateTools}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 4:
                return (
                    <QuickPromptsStep
                        quickPrompts={quickPrompts}
                        isOwner={isOwner}
                        onQuickPromptsChange={assistantState.setQuickPrompts}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 5:
                return (
                    <ExamplesStep
                        examples={examples}
                        isOwner={isOwner}
                        onExamplesChange={assistantState.setExamples}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 6:
                if (publish) {
                    return (
                        <VisibilityStep
                            isOwner={isOwner}
                            publishDepartments={hierarchicalAccess}
                            invisibleChecked={!isVisible}
                            onHasChanged={assistantState.setHasChanged}
                            setPublishDepartments={assistantState.updateHierarchicalAccess}
                            setInvisibleChecked={(invisible: boolean) => assistantState.updateIsVisible(!invisible)}
                        />
                    );
                } else {
                    return (
                        <AdvancedSettingsStep
                            temperature={temperature}
                            maxOutputTokens={maxOutputTokens}
                            isOwner={isOwner}
                            onTemperatureChange={assistantState.updateTemperature}
                            onMaxTokensChange={assistantState.updateMaxTokens}
                            onHasChanged={assistantState.setHasChanged}
                        />
                    );
                }

            case 7:
                return (
                    <AdvancedSettingsStep
                        temperature={temperature}
                        maxOutputTokens={maxOutputTokens}
                        isOwner={isOwner}
                        onTemperatureChange={assistantState.updateTemperature}
                        onMaxTokensChange={assistantState.updateMaxTokens}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            default:
                return <TitleStep title={title} isOwner={isOwner} onTitleChange={assistantState.updateTitle} onHasChanged={assistantState.setHasChanged} />;
        }
    }, [
        currentStep,
        title,
        description,
        systemPrompt,
        tools,
        selectedTools,
        quickPrompts,
        examples,
        temperature,
        maxOutputTokens,
        publish,
        hierarchicalAccess,
        isVisible,
        isOwner,
        assistantState
    ]);

    return (
        <div>
            <Dialog
                modalType="alert"
                open={showDialog}
                onOpenChange={(event, data) => {
                    if (assistantState.hasChanged) {
                        setCloseDialogOpen(true);
                    } else {
                        setShowDialog(data.open);
                        if (!data.open) {
                            setCurrentStep(0);
                        }
                    }
                }}
            >
                <DialogSurface className={styles.dialog}>
                    <div className={styles.dialogHeader}>
                        <DialogTitle>{t("components.edit_assistant_dialog.title")}</DialogTitle>
                        <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => {
                                if (assistantState.hasChanged) {
                                    setCloseDialogOpen(true);
                                } else {
                                    setShowDialog(false);
                                    setCurrentStep(0);
                                }
                            }}
                            className={styles.closeButton}
                            icon={<Dismiss24Regular />}
                        />
                    </div>
                    <br />
                    <div className={styles.stepperFullWidth}>
                        <StepperProgress currentStep={currentStep} totalSteps={totalSteps} stepTitles={stepTitles} />
                    </div>
                    <DialogBody className={styles.scrollableDialogContent}>{getCurrentStepContent}</DialogBody>
                    <div className={styles.dialogActionsContainer}>
                        <div className={styles.stepperActions}>
                            <EditDialogActions
                                currentStep={currentStep}
                                totalSteps={totalSteps}
                                canProceedToNext={canProceedToNext}
                                onNextStep={nextStep}
                                onPrevStep={prevStep}
                                isOwner={isOwner}
                                onSave={onSaveButtonClicked}
                            />
                        </div>
                    </div>
                </DialogSurface>
            </Dialog>
            {closeDialog}
        </div>
    );
};
