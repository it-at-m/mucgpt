import { Dismiss24Regular } from "@fluentui/react-icons";
import { Dialog, DialogActions, DialogBody, DialogSurface, DialogTitle, Button } from "@fluentui/react-components";

import styles from "./EditBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useState, useMemo, useEffect, useContext } from "react";
import { Bot, ToolBase, ToolInfo, ToolListResponse } from "../../api";
import { ToolsSelector } from "../ToolsSelector";
import { StepperProgress } from "./StepperProgress";
import { EditDialogActions } from "./EditDialogActions";
import { useBotState } from "./useBotState";
import { TitleStep, DescriptionStep, SystemPromptStep, ToolsStep, QuickPromptsStep, ExamplesStep, AdvancedSettingsStep } from "./steps";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

import { getTools } from "../../api/core-client";
import { BotStrategy } from "../../pages/bot/BotStrategy";
import { VisibilityStep } from "./steps/VisibilityStep";
import { mapContextToBackendLang } from "../../utils/language-utils";
import { LanguageContext } from "../LanguageSelector/LanguageContextProvider";

interface Props {
    showDialog: boolean;
    setShowDialog: (showDialog: boolean) => void;
    bot: Bot;
    onBotChanged: (bot: Bot) => void;
    isOwner: boolean;
    strategy: BotStrategy;
}

export const EditBotDialog = ({ showDialog, setShowDialog, bot, onBotChanged, isOwner, strategy }: Props) => {
    // Toast setup
    const { showSuccess } = useGlobalToastContext();

    // Stepper state
    const [currentStep, setCurrentStep] = useState<number>(0);
    const totalSteps = 8;
    const stepTitles = [
        "components.edit_bot_dialog.step_title",
        "components.edit_bot_dialog.step_description",
        "components.edit_bot_dialog.step_system_prompt",
        "components.edit_bot_dialog.step_tools",
        "components.edit_bot_dialog.step_quick_prompts",
        "components.edit_bot_dialog.step_examples",
        "components.edit_bot_dialog.step_visibility",
        "components.edit_bot_dialog.step_advanced_settings"
    ];

    const botState = useBotState(bot);
    const { title, description, systemPrompt, quickPrompts, examples, temperature, maxOutputTokens, tools, publish, hierarchicalAccess, isVisible } = botState;
    const [closeDialogOpen, setCloseDialogOpen] = useState<boolean>(false);

    useEffect(() => {
        console.log("Bot visibility changed:", isVisible);
    }, [isVisible]);

    const { t } = useTranslation();
    const { language } = useContext(LanguageContext);

    // Tools state
    const [availableTools, setAvailableTools] = useState<ToolListResponse | undefined>(undefined);
    const [showToolsSelector, setShowToolsSelector] = useState<boolean>(false);
    const [selectedTools, setSelectedTools] = useState<ToolInfo[]>([]);

    // Load available tools when dialog opens
    useEffect(() => {
        if (showDialog && !availableTools) {
            const fetchTools = async () => {
                try {
                    // Get current language from context and map to backend format
                    const backendLang = mapContextToBackendLang(language);
                    const toolsResponse = await getTools(backendLang);
                    setAvailableTools(toolsResponse);
                } catch (error) {
                    console.error("Failed to fetch tools:", error);
                }
            };
            fetchTools();
        }
    }, [showDialog, availableTools, language]);

    // Update selectedTools when tools change
    useEffect(() => {
        if (availableTools && tools.length > 0) {
            const toolInfos = tools.map(tool => availableTools.tools.find(t => t.id === tool.id)).filter(Boolean) as ToolInfo[];
            setSelectedTools(toolInfos);
        } else {
            setSelectedTools([]);
        }
    }, [tools, availableTools]);

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

    // Helper functions for tools
    const handleToolsSelected = (selectedTools?: ToolInfo[]) => {
        if (selectedTools) {
            const newTools: ToolBase[] = selectedTools.map(tool => ({
                id: tool.id,
                config: {}
            }));
            botState.setTools(newTools);
            setSelectedTools(selectedTools);
            botState.setHasChanged(true);
        }
        setShowToolsSelector(false);
    };

    // save bot
    const onSaveButtonClicked = useCallback(async () => {
        if (!isOwner && !botState.botId) {
            setShowDialog(false);
            return;
        }
        const newBot = botState.createBotForSaving();
        await onBotChanged(newBot);
        setCurrentStep(0);

        // Show success toast
        if (isOwner)
            showSuccess(t("components.edit_bot_dialog.saved_successfully"), t("components.edit_bot_dialog.bot_saved_description", { botName: newBot.title }));

        // For owned community bots, reload the page to ensure latest version is fetched
        if (strategy.requiresReloadOnSave) {
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            // Close dialog after a short delay for local bots
            setTimeout(() => {
                setShowDialog(false);
            }, 500);
        }
    }, [isOwner, botState, onBotChanged, showSuccess, t, setShowDialog, strategy]);

    // close dialog pressed function
    const closeDialogPressed = useCallback(() => {
        setCloseDialogOpen(false);
        setShowDialog(false);
        setCurrentStep(0);
        botState.resetToOriginal();
    }, [setShowDialog, botState]);

    // close dialog
    const closeDialog = useMemo(() => {
        return (
            <Dialog modalType="alert" open={closeDialogOpen} onOpenChange={(_event, data) => setCloseDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogTitle>{t("components.edit_bot_dialog.close_dialog_title")}</DialogTitle>
                    <DialogBody>{t("components.edit_bot_dialog.close_dialog_message")}</DialogBody>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setCloseDialogOpen(false)}>
                            {t("components.edit_bot_dialog.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={closeDialogPressed}>
                            {t("components.edit_bot_dialog.close")}
                        </Button>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
        );
    }, [closeDialogOpen, t, closeDialogPressed]);

    // Function to render current step content
    const getCurrentStepContent = () => {
        switch (currentStep) {
            case 0:
                return <TitleStep title={title} isOwner={isOwner} onTitleChange={botState.updateTitle} onHasChanged={botState.setHasChanged} />;
            case 1:
                return (
                    <DescriptionStep
                        description={description}
                        isOwner={isOwner}
                        onDescriptionChange={botState.updateDescription}
                        onHasChanged={botState.setHasChanged}
                    />
                );
            case 2:
                return (
                    <SystemPromptStep
                        systemPrompt={systemPrompt}
                        isOwner={isOwner}
                        onSystemPromptChange={botState.updateSystemPrompt}
                        onHasChanged={botState.setHasChanged}
                    />
                );
            case 3:
                return (
                    <ToolsStep
                        tools={tools}
                        selectedTools={selectedTools}
                        isOwner={isOwner}
                        onToolsChange={botState.updateTools}
                        onSelectedToolsChange={setSelectedTools}
                        onShowToolsSelector={() => setShowToolsSelector(true)}
                        onHasChanged={botState.setHasChanged}
                    />
                );
            case 4:
                return (
                    <QuickPromptsStep
                        quickPrompts={quickPrompts}
                        isOwner={isOwner}
                        onQuickPromptsChange={botState.setQuickPrompts}
                        onHasChanged={botState.setHasChanged}
                    />
                );
            case 5:
                return <ExamplesStep examples={examples} isOwner={isOwner} onExamplesChange={botState.setExamples} onHasChanged={botState.setHasChanged} />;
            case 6:
                return (
                    <VisibilityStep
                        isOwner={isOwner}
                        publish={publish}
                        publishDepartments={hierarchicalAccess}
                        invisibleChecked={!isVisible}
                        onHasChanged={botState.setHasChanged}
                        setPublishDepartments={botState.updateHierarchicalAccess}
                        setInvisibleChecked={(invisible: boolean) => botState.updateIsVisible(!invisible)}
                    />
                );

            case 7:
                return (
                    <AdvancedSettingsStep
                        temperature={temperature}
                        maxOutputTokens={maxOutputTokens}
                        isOwner={isOwner}
                        onTemperatureChange={botState.updateTemperature}
                        onMaxTokensChange={botState.updateMaxTokens}
                        onHasChanged={botState.setHasChanged}
                    />
                );
            default:
                return <TitleStep title={title} isOwner={isOwner} onTitleChange={botState.updateTitle} onHasChanged={botState.setHasChanged} />;
        }
    };

    return (
        <div>
            <Dialog
                modalType="alert"
                open={showDialog}
                onOpenChange={(event, data) => {
                    if (botState.hasChanged) {
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
                        <DialogTitle>{t("components.edit_bot_dialog.title")}</DialogTitle>
                        <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => {
                                if (botState.hasChanged) {
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
                    <DialogBody className={styles.scrollableDialogContent}>{getCurrentStepContent()}</DialogBody>
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
            <ToolsSelector open={showToolsSelector} onClose={handleToolsSelected} tools={availableTools} selectedTools={selectedTools} />
            {closeDialog}
        </div>
    );
};
