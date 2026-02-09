import { Checkmark24Filled, ArrowImport24Filled, Dismiss24Regular } from "@fluentui/react-icons";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Textarea,
    TextareaOnChangeData,
    Tooltip
} from "@fluentui/react-components";

import styles from "./CreateAssistantDialog.module.css";
import sharedStyles from "../shared/AssistantDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useState, useMemo } from "react";
import { LLMContext } from "../../LLMSelector/LLMContextProvider";
import { Assistant, ToolInfo } from "../../../api";
import { ASSISTANT_STORE, CREATIVITY_LOW } from "../../../constants";
import { AssistantStorageService } from "../../../service/assistantstorage";
import { createAssistantApi } from "../../../api/core-client";
import { useGlobalToastContext } from "../../GlobalToastHandler/GlobalToastContext";
import { Stepper, Step } from "../../Stepper";
import { CombinedDetailsStep, ToolsStep, QuickPromptsStep, ExamplesStep, AdvancedSettingsStep, useCreateAssistantState } from "../shared";
import { CloseConfirmationDialog } from "../shared/CloseConfirmationDialog";
import { useToolsContext } from "../../ToolsProvider";
import { useNavigate } from "react-router-dom";

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

const storageService = new AssistantStorageService(ASSISTANT_STORE);

export const CreateAssistantDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [closeDialogOpen, setCloseDialogOpen] = useState<boolean>(false);

    // Context
    const { LLM } = useContext(LLMContext);
    const { showError, showSuccess } = useGlobalToastContext();
    const { tools: availableTools } = useToolsContext();
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Use the custom hook for state management
    const {
        input,
        title,
        description,
        systemPrompt,
        selectedTemplate,
        tools,
        quickPrompts,
        examples,
        creativity,
        defaultModel,
        hasChanges,
        updateInput,
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        updateCreativity,
        updateDefaultModel,
        updateTools,
        updateTemplate,
        setQuickPrompts,
        setExamples,
        setGeneratedAssistant,
        resetAll
    } = useCreateAssistantState();

    const selectedTools = useMemo(() => {
        if (!availableTools) {
            return [] as ToolInfo[];
        }

        const toolMap = new Map(availableTools.tools.map(tool => [tool.id, tool]));
        return tools.map(tool => toolMap.get(tool.id)).filter(Boolean) as ToolInfo[];
    }, [availableTools, tools]);

    // input change
    const onInputChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            updateInput(newValue?.value || "");
        },
        [updateInput]
    );

    // save assistant
    const onPromptButtonClicked = useCallback(async () => {
        try {
            const validQuickPrompts = quickPrompts.filter(qp => qp.label?.trim() && qp.prompt?.trim());
            const validExamples = examples.filter(ex => ex.text?.trim() && ex.value?.trim());

            const assistant: Assistant = {
                title: title === "" ? t("components.create_assistant_dialog.default_assistant_title") : title,
                description: description === "" ? t("components.create_assistant_dialog.default_assistant_description") : description,
                system_message: systemPrompt,
                publish: false,
                creativity: creativity,
                default_model: defaultModel,
                quick_prompts: validQuickPrompts,
                examples: validExamples,
                version: "0",
                owner_ids: [],
                tags: [],
                hierarchical_access: [],
                tools: tools,
                is_visible: true
            };
            const created_id = await storageService.createAssistantConfig(assistant);
            if (created_id) {
                showSuccess(
                    t("components.create_assistant_dialog.assistant_saved_success"),
                    t("components.create_assistant_dialog.assistant_saved_message", { title: assistant.title })
                );
                navigate(`/assistant/${created_id}`);
            } else {
                console.error("Assistant could not be created");
                showError(t("components.create_assistant_dialog.assistant_creation_failed"), t("components.create_assistant_dialog.save_config_failed"));
            }
        } catch (error) {
            console.error("Failed to save assistant", error);
            const errorMessage = error instanceof Error ? error.message : t("components.create_assistant_dialog.save_assistant_failed");
            showError(t("components.create_assistant_dialog.assistant_save_failed"), errorMessage);
        }
    }, [title, description, systemPrompt, creativity, defaultModel, quickPrompts, examples, tools, showError, showSuccess, t, navigate]);

    // cancel button clicked
    const onCancelButtonClicked = useCallback(() => {
        setShowDialogInput(false);
        setCurrentStep(1);
        resetAll();
    }, [setShowDialogInput, resetAll]);

    // call Assistant api
    const createAssistant = useCallback(async () => {
        if (input !== "") {
            setLoading(true);
            try {
                const result = await (await createAssistantApi({ input: input, model: LLM.llm_name })).json();
                setGeneratedAssistant(result.title, result.description, result.system_prompt);
                setCurrentStep(2);
                showSuccess(
                    t("components.create_assistant_dialog.assistant_generated_success"),
                    t("components.create_assistant_dialog.assistant_generated_message")
                );
            } catch (error) {
                console.error("Failed to create assistant", error);
                const errorMessage = error instanceof Error ? error.message : t("components.create_assistant_dialog.assistant_generation_failed");
                showError(t("components.create_assistant_dialog.assistant_creation_failed"), errorMessage);
            } finally {
                setLoading(false);
            }
        }
    }, [input, LLM.llm_name, setGeneratedAssistant, showError, showSuccess, t]);

    const handleTemplateSelect = useCallback(
        (template: string, templateId: string) => {
            updateTemplate(template, templateId);
        },
        [updateTemplate]
    );

    const handleContinueWithMucGPT = useCallback(async () => {
        await createAssistant();
    }, [createAssistant]);

    const handleDefineMyself = useCallback(() => {
        updateDescription(input);
        setCurrentStep(2);
    }, [input, updateDescription]);

    // Import assistant from JSON file
    const importAssistant = useCallback(() => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";

        fileInput.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                // Read and parse file
                const content = await file.text();
                const importedData = JSON.parse(content);

                // Basic validation - check required fields
                if (!importedData.title || !importedData.system_message) {
                    throw new Error(t("components.create_assistant_dialog.import_invalid_format"));
                }

                // Create assistant object with imported data
                const assistant: Assistant = {
                    title: importedData.title,
                    description: importedData.description || "",
                    system_message: importedData.system_message,
                    publish: false,
                    creativity: importedData.creativity || CREATIVITY_LOW,
                    default_model: importedData.default_model ?? defaultModel,
                    quick_prompts: importedData.quick_prompts || [],
                    examples: importedData.examples || [],
                    version: "0",
                    owner_ids: [],
                    tags: importedData.tags || [],
                    hierarchical_access: [],
                    tools: importedData.tools || [],
                    is_visible: true
                };

                const created_id = await storageService.createAssistantConfig(assistant);

                if (created_id) {
                    setShowDialogInput(false);
                    resetAll();

                    showSuccess(
                        t("components.create_assistant_dialog.import_success"),
                        t("components.create_assistant_dialog.import_success_message", { title: assistant.title })
                    );

                    navigate(`/assistant/${created_id}`);
                } else {
                    throw new Error(t("components.create_assistant_dialog.import_save_failed"));
                }
            } catch (error) {
                console.error("Failed to import assistant", error);
                const errorMessage = error instanceof Error ? error.message : t("components.create_assistant_dialog.import_failed");
                showError(t("components.create_assistant_dialog.import_error"), errorMessage);
            }
        };

        // Trigger file picker
        fileInput.click();
    }, [t, showSuccess, showError, navigate, setShowDialogInput, resetAll]);

    const steps: Step[] = useMemo(
        () => [
            {
                label: t("components.create_assistant_dialog.step1_label"),
                completedIcon: <Checkmark24Filled />
            },
            {
                label: t("components.create_assistant_dialog.step2_label"),
                completedIcon: <Checkmark24Filled />
            },
            {
                label: t("components.edit_assistant_dialog.step_tools"),
                completedIcon: <Checkmark24Filled />
            },
            {
                label: t("components.edit_assistant_dialog.step_quick_prompts"),
                completedIcon: <Checkmark24Filled />
            },
            {
                label: t("components.edit_assistant_dialog.step_examples"),
                completedIcon: <Checkmark24Filled />
            },
            {
                label: t("components.edit_assistant_dialog.step_advanced_settings"),
                completedIcon: <Checkmark24Filled />
            }
        ],
        [t]
    );

    const currentStepContent = useMemo(() => {
        switch (currentStep) {
            case 1: // Step 1: Describe function
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />

                            <p className={sharedStyles.hintText}>
                                <strong>{t("common.hint")}</strong> {t("components.create_assistant_dialog.hint_text")}
                            </p>

                            <Field size="large" className={sharedStyles.fieldSection}>
                                <label className={sharedStyles.fieldLabel}>{t("components.create_assistant_dialog.description")}:</label>
                                <Textarea
                                    placeholder={t("components.create_assistant_dialog.description_placeholder")}
                                    size="large"
                                    rows={3}
                                    resize="vertical"
                                    value={input}
                                    onChange={onInputChanged}
                                    disabled={loading}
                                />
                            </Field>

                            <div>
                                <label className={sharedStyles.fieldLabel}>{t("components.create_assistant_dialog.or_choose_template")}</label>
                                <div className={styles.chipContainer}>
                                    <Button
                                        className={`${styles.templateChip} ${selectedTemplate === "example_one" ? styles.selected : ""}`}
                                        onClick={() => handleTemplateSelect(t("components.create_assistant_dialog.create_example_one"), "example_one")}
                                        disabled={loading}
                                    >
                                        {t("components.create_assistant_dialog.example_one")}
                                    </Button>
                                    <Button
                                        className={`${styles.templateChip} ${selectedTemplate === "example_two" ? styles.selected : ""}`}
                                        onClick={() => handleTemplateSelect(t("components.create_assistant_dialog.create_example_two"), "example_two")}
                                        disabled={loading}
                                    >
                                        {t("components.create_assistant_dialog.example_two")}
                                    </Button>
                                    <Button
                                        className={`${styles.templateChip} ${selectedTemplate === "example_three" ? styles.selected : ""}`}
                                        onClick={() => handleTemplateSelect(t("components.create_assistant_dialog.create_example_three"), "example_three")}
                                        disabled={loading}
                                    >
                                        {t("components.create_assistant_dialog.example_three")}
                                    </Button>
                                </div>
                            </div>

                            <p hidden={!loading}>{t("components.create_assistant_dialog.generating_prompt")}</p>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button disabled={loading} size="medium" onClick={handleDefineMyself} className={sharedStyles.defineButton}>
                                {t("components.create_assistant_dialog.define_myself")}
                            </Button>
                            <Tooltip
                                content={input === "" ? t("components.create_assistant_dialog.description_required") : ""}
                                relationship="label"
                                positioning="above"
                            >
                                <Button
                                    disabled={loading || input === ""}
                                    size="medium"
                                    onClick={handleContinueWithMucGPT}
                                    className={sharedStyles.continueButton}
                                >
                                    {t("components.create_assistant_dialog.continue_with_mucgpt")}
                                </Button>
                            </Tooltip>
                        </DialogActions>
                    </>
                );
            case 2: // Step 2: Create assistant (Title, Description, System Prompt)
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <CombinedDetailsStep
                                title={title}
                                description={description}
                                systemPrompt={systemPrompt}
                                isOwner={true}
                                onTitleChange={updateTitle}
                                onDescriptionChange={updateDescription}
                                onSystemPromptChange={updateSystemPrompt}
                            />
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={() => setCurrentStep(1)} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>
                            <Button
                                size="medium"
                                onClick={() => setCurrentStep(3)}
                                className={sharedStyles.continueButton}
                                disabled={title.trim() === "" || systemPrompt.trim() === ""}
                            >
                                {t("common.next")}
                            </Button>
                        </DialogActions>
                    </>
                );
            case 3: // Step 3: Tools
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <div className={sharedStyles.scrollableDialogContent}>
                                <ToolsStep selectedTools={selectedTools} availableTools={availableTools} onToolsChange={updateTools} />
                            </div>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={() => setCurrentStep(2)} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>
                            <Button size="medium" onClick={() => setCurrentStep(4)} className={sharedStyles.continueButton}>
                                {t("common.next")}
                            </Button>
                        </DialogActions>
                    </>
                );
            case 4: // Step 4: Quick Prompts
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <div className={sharedStyles.scrollableDialogContent}>
                                <QuickPromptsStep quickPrompts={quickPrompts} isOwner={true} onQuickPromptsChange={setQuickPrompts} />
                            </div>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={() => setCurrentStep(3)} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>
                            <Button size="medium" onClick={() => setCurrentStep(5)} className={sharedStyles.continueButton}>
                                {t("common.next")}
                            </Button>
                        </DialogActions>
                    </>
                );
            case 5: // Step 5: Examples
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <div className={sharedStyles.scrollableDialogContent}>
                                <ExamplesStep examples={examples} isOwner={true} onExamplesChange={setExamples} />
                            </div>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={() => setCurrentStep(4)} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>
                            <Button size="medium" onClick={() => setCurrentStep(6)} className={sharedStyles.continueButton}>
                                {t("common.next")}
                            </Button>
                        </DialogActions>
                    </>
                );
            case 6: // Step 6: Advanced Settings
                return (
                    <>
                        <DialogContent>
                            <Stepper steps={steps} currentStep={currentStep} />
                            <div className={sharedStyles.scrollableDialogContent}>
                                <AdvancedSettingsStep
                                    creativity={creativity}
                                    defaultModel={defaultModel}
                                    isOwner={true}
                                    onCreativityChange={updateCreativity}
                                    onDefaultModelChange={updateDefaultModel}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions className={sharedStyles.dialogActions}>
                            <Button size="medium" onClick={() => setCurrentStep(5)} className={sharedStyles.backButton}>
                                {t("common.back")}
                            </Button>
                            <Button
                                size="medium"
                                onClick={() => {
                                    if (hasChanges) {
                                        setCloseDialogOpen(true);
                                    } else {
                                        onCancelButtonClicked();
                                    }
                                }}
                                className={sharedStyles.cancelButton}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button size="medium" onClick={onPromptButtonClicked} className={sharedStyles.createButton}>
                                {t("common.create")}
                            </Button>
                        </DialogActions>
                    </>
                );
            default:
                console.error(`Invalid step: ${currentStep}. This should not happen.`);
                return null;
        }
    }, [
        currentStep,
        steps,
        t,
        input,
        loading,
        selectedTemplate,
        handleTemplateSelect,
        handleDefineMyself,
        handleContinueWithMucGPT,
        onInputChanged,
        title,
        description,
        systemPrompt,
        updateTitle,
        updateDescription,
        updateSystemPrompt,
        selectedTools,
        availableTools,
        updateTools,
        quickPrompts,
        setQuickPrompts,
        examples,
        setExamples,
        creativity,
        updateCreativity,
        hasChanges,
        onCancelButtonClicked,
        onPromptButtonClicked
    ]);

    const handleConfirmClose = useCallback(() => {
        onCancelButtonClicked();
    }, [onCancelButtonClicked]);

    return (
        <div>
            <Dialog
                modalType="alert"
                open={showDialogInput && !closeDialogOpen}
                onOpenChange={(_event, data) => {
                    if (!data.open && hasChanges) {
                        setCloseDialogOpen(true);
                    } else if (!data.open) {
                        onCancelButtonClicked();
                    } else {
                        setShowDialogInput(data.open);
                    }
                }}
            >
                <DialogSurface className={sharedStyles.dialog}>
                    <div className={sharedStyles.dialogHeader}>
                        <DialogTitle className={sharedStyles.dialogTitle}>{t("components.create_assistant_dialog.dialog_title")}</DialogTitle>
                        <div className={sharedStyles.dialogHeaderActions}>
                            {currentStep === 1 && (
                                <Button size="medium" icon={<ArrowImport24Filled />} onClick={importAssistant} className={sharedStyles.importButton}>
                                    {t("components.create_assistant_dialog.import")}
                                </Button>
                            )}
                            <Button
                                appearance="subtle"
                                size="small"
                                onClick={() => {
                                    if (hasChanges) {
                                        setCloseDialogOpen(true);
                                    } else {
                                        onCancelButtonClicked();
                                    }
                                }}
                                className={sharedStyles.closeButton}
                                icon={<Dismiss24Regular />}
                            />
                        </div>
                    </div>
                    <DialogBody className={sharedStyles.dialogContent}>{currentStepContent}</DialogBody>
                </DialogSurface>
            </Dialog>
            <CloseConfirmationDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} onConfirmClose={handleConfirmClose} />
        </div>
    );
};
