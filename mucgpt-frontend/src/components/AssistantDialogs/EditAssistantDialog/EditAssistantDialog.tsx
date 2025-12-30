import { Dismiss24Regular, Checkmark24Filled } from "@fluentui/react-icons";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Button } from "@fluentui/react-components";

import sharedStyles from "../shared/AssistantDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useState, useMemo, useEffect } from "react";
import { Assistant, ToolInfo } from "../../../api";
import { Stepper, Step } from "../../Stepper";
import { useAssistantState, CombinedDetailsStep, ToolsStep, QuickPromptsStep, ExamplesStep, AdvancedSettingsStep, VisibilityStep } from "../shared";
import { CloseConfirmationDialog } from "../shared/CloseConfirmationDialog";
import { useGlobalToastContext } from "../../GlobalToastHandler/GlobalToastContext";
import { AssistantStrategy } from "../../../pages/assistant/AssistantStrategy";
import { useToolsContext } from "../../ToolsProvider";

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

    // Stepper state (1-based indexing)
    const [currentStep, setCurrentStep] = useState<number>(1);

    const assistantState = useAssistantState(assistant);
    const { title, description, systemPrompt, quickPrompts, examples, temperature, maxOutputTokens, tools, publish, hierarchicalAccess, isVisible } =
        assistantState;

    const [closeDialogOpen, setCloseDialogOpen] = useState<boolean>(false);

    const { t } = useTranslation();
    const { tools: availableTools } = useToolsContext();

    // Create steps array for Stepper component (matching CreateAssistantDialog structure)
    const steps: Step[] = useMemo(() => {
        const baseSteps = [
            { label: t("components.create_assistant_dialog.step2_label"), completedIcon: <Checkmark24Filled /> }, // Combined: Title, Description, System Prompt
            { label: t("components.edit_assistant_dialog.step_tools"), completedIcon: <Checkmark24Filled /> },
            { label: t("components.edit_assistant_dialog.step_quick_prompts"), completedIcon: <Checkmark24Filled /> },
            { label: t("components.edit_assistant_dialog.step_examples"), completedIcon: <Checkmark24Filled /> }
        ];

        if (publish) {
            baseSteps.push({ label: t("components.edit_assistant_dialog.step_visibility"), completedIcon: <Checkmark24Filled /> });
        }

        baseSteps.push({ label: t("components.edit_assistant_dialog.step_advanced_settings"), completedIcon: <Checkmark24Filled /> });

        return baseSteps;
    }, [t, publish]);

    // Conditionally adjust total steps based on publish status
    const totalSteps = steps.length;

    const selectedTools = useMemo(() => {
        if (!availableTools) {
            return [] as ToolInfo[];
        }

        const toolMap = new Map(availableTools.tools.map(tool => [tool.id, tool]));
        return tools.map(tool => toolMap.get(tool.id)).filter(Boolean) as ToolInfo[];
    }, [availableTools, tools]);

    useEffect(() => {
        if (!showDialog) {
            setCurrentStep(1);
        }
    }, [showDialog]);

    // Stepper navigation functions
    const nextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const canProceedToNext = () => {
        switch (currentStep) {
            case 1: // Combined step: Title + System Prompt
                return title.trim() !== "" && systemPrompt.trim() !== "";
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
        setCurrentStep(1);

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
        setShowDialog(false);
        setCurrentStep(1);
        assistantState.resetToOriginal();
    }, [setShowDialog, assistantState]);

    // Function to render current step content
    const getCurrentStepContent = useMemo(() => {
        switch (currentStep) {
            case 1: // Combined: Title + Description + System Prompt
                return (
                    <CombinedDetailsStep
                        title={title}
                        description={description}
                        systemPrompt={systemPrompt}
                        isOwner={isOwner}
                        onTitleChange={assistantState.updateTitle}
                        onDescriptionChange={assistantState.updateDescription}
                        onSystemPromptChange={assistantState.updateSystemPrompt}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 2: // Tools
                return (
                    <ToolsStep
                        selectedTools={selectedTools}
                        availableTools={availableTools}
                        onToolsChange={assistantState.updateTools}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 3: // Quick Prompts
                return (
                    <QuickPromptsStep
                        quickPrompts={quickPrompts}
                        isOwner={isOwner}
                        onQuickPromptsChange={assistantState.setQuickPrompts}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 4: // Examples
                return (
                    <ExamplesStep
                        examples={examples}
                        isOwner={isOwner}
                        onExamplesChange={assistantState.setExamples}
                        onHasChanged={assistantState.setHasChanged}
                    />
                );
            case 5:
                // Step 5 is either Visibility (if published) or Advanced Settings (if not published)
                if (publish) {
                    return (
                        <VisibilityStep
                            isOwner={isOwner}
                            publishDepartments={hierarchicalAccess}
                            invisibleChecked={!isVisible}
                            onHasChanged={assistantState.setHasChanged}
                            setPublishDepartments={assistantState.updateHierarchicalAccess}
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

            case 6: // Advanced Settings (only when published)
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
                console.error(`Invalid step: ${currentStep}. This should not happen.`);
                return null;
        }
    }, [
        currentStep,
        title,
        description,
        systemPrompt,
        selectedTools,
        availableTools,
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
                open={showDialog && !closeDialogOpen}
                onOpenChange={(event, data) => {
                    if (assistantState.hasChanged) {
                        setCloseDialogOpen(true);
                    } else {
                        setShowDialog(data.open);
                        if (!data.open) {
                            setCurrentStep(1);
                        }
                    }
                }}
            >
                <DialogSurface className={sharedStyles.dialog}>
                    <div className={sharedStyles.dialogHeader}>
                        <DialogTitle className={sharedStyles.dialogTitle}>{t("components.edit_assistant_dialog.title")}</DialogTitle>
                        <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => {
                                if (assistantState.hasChanged) {
                                    setCloseDialogOpen(true);
                                } else {
                                    setShowDialog(false);
                                    setCurrentStep(1);
                                }
                            }}
                            className={sharedStyles.closeButton}
                            icon={<Dismiss24Regular />}
                        />
                    </div>
                    <DialogBody className={sharedStyles.dialogContent}>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <div className={sharedStyles.scrollableDialogContent}>{getCurrentStepContent}</div>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={prevStep} disabled={currentStep === 1} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>

                            <Button size="medium" onClick={onSaveButtonClicked} className={sharedStyles.saveButton}>
                                {isOwner ? t("components.edit_assistant_dialog.save") : t("common.close")}
                            </Button>

                            <Button
                                size="medium"
                                onClick={nextStep}
                                disabled={!canProceedToNext() || currentStep === totalSteps}
                                className={sharedStyles.continueButton}
                            >
                                {t("common.next")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <CloseConfirmationDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} onConfirmClose={closeDialogPressed} />
        </div>
    );
};
