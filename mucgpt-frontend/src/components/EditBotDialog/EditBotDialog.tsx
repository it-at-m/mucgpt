import {
    Checkmark24Filled,
    Dismiss24Regular,
    Add24Regular,
    Delete24Regular,
    Save24Filled,
    ChevronLeft24Regular,
    ChevronRight24Regular
} from "@fluentui/react-icons";
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
    Input,
    TextareaOnChangeData,
} from "@fluentui/react-components";

import styles from "./EditBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useState, useMemo, useEffect } from "react";
import { Bot, ToolBase, ToolInfo, ToolListResponse, getTools } from "../../api";
import { QuickPrompt } from "../QuickPrompt/QuickPrompt";
import { ExampleModel } from "../Example";
import { ToolsSelector } from "../ToolsSelector";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { HeaderContext } from "../../pages/layout/HeaderContextProvider";

interface Props {
    showDialog: boolean;
    setShowDialog: (showDialog: boolean) => void;
    bot: Bot;
    onBotChanged: (bot: Bot) => void;
    isOwner: boolean;
}

export const EditBotDialog = ({ showDialog, setShowDialog, bot, onBotChanged, isOwner }: Props) => {
    // Stepper state
    const [currentStep, setCurrentStep] = useState<number>(0);
    const totalSteps = 7;
    const stepTitles = [
        "components.edit_bot_dialog.step_title",
        "components.edit_bot_dialog.step_description",
        "components.edit_bot_dialog.step_system_prompt",
        "components.edit_bot_dialog.step_tools",
        "components.edit_bot_dialog.step_quick_prompts",
        "components.edit_bot_dialog.step_examples",
        "components.edit_bot_dialog.step_advanced_settings"
    ];

    const [showSavedMessage, setShowSavedMessage] = useState<boolean>(false);
    const [botId, setBotId] = useState<string | undefined>(bot.id);
    const [title, setTitle] = useState<string>(bot.title);
    const [description, setDescription] = useState<string>(bot.description);
    const [systemPrompt, setSystemPrompt] = useState<string>(bot.system_message);
    const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(bot.quick_prompts || []);
    const [examples, setExamples] = useState<ExampleModel[]>(bot.examples || []);
    const [temperature, setTemperature] = useState<number>(bot.temperature);
    const [maxOutputTokens, setMaxOutputTokens] = useState<number>(bot.max_output_tokens);
    const [version, setVersion] = useState<string>(bot.version || "0");
    const [tools, setTools] = useState<ToolBase[]>(bot.tools || []);
    const [publish, setPublish] = useState<boolean>(bot.publish || false);
    const [ownerIds, setOwnerIds] = useState<string[]>(bot.owner_ids || []);
    const [hierarchicalAccess, setHierarchicalAccess] = useState<string[]>(bot.hirachical_access || []);
    const [tags, setTags] = useState<string[]>(bot.tags || []);

    // Context
    const { setHeader } = useContext(HeaderContext);
    const { t } = useTranslation();

    // Tools state
    const [availableTools, setAvailableTools] = useState<ToolListResponse | undefined>(undefined);
    const [showToolsSelector, setShowToolsSelector] = useState<boolean>(false);
    const [selectedTools, setSelectedTools] = useState<ToolInfo[]>([]);

    // Update state when bot prop changes
    useEffect(() => {
        setBotId(bot.id);
        setTitle(bot.title);
        setDescription(bot.description);
        setSystemPrompt(bot.system_message);
        setQuickPrompts(bot.quick_prompts || []);
        setExamples(bot.examples || []);
        setTemperature(bot.temperature);
        setMaxOutputTokens(bot.max_output_tokens || 1024);
        setVersion(bot.version || "0");
        setTools(bot.tools || []);
        setPublish(bot.publish || false);
        setOwnerIds(bot.owner_ids || []);
        setHierarchicalAccess(bot.hirachical_access || []);
        setTags(bot.tags || []);
        // Reset to first step when bot changes
        setCurrentStep(0);
    }, [bot]);

    // Load available tools when dialog opens
    useEffect(() => {
        if (showDialog && !availableTools) {
            const fetchTools = async () => {
                try {
                    const toolsResponse = await getTools();
                    setAvailableTools(toolsResponse);
                } catch (error) {
                    console.error("Failed to fetch tools:", error);
                }
            };
            fetchTools();
        }
    }, [showDialog, availableTools]);

    // Update selectedTools when tools change
    useEffect(() => {
        if (availableTools && tools.length > 0) {
            const toolInfos = tools.map(tool =>
                availableTools.tools.find(t => t.name === tool.id)
            ).filter(Boolean) as ToolInfo[];
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

    // description change
    const onDescriptionChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setDescription(newValue.value);
        } else {
            setDescription("");
        }
    }, []);

    // title change
    const onTitleChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setTitle(newValue.value);
        } else {
            setTitle("Assistent");
        }
    }, []);

    // system prompt change
    const onPromptChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setSystemPrompt(newValue.value);
        } else {
            setSystemPrompt("");
        }
    }, []);


    // Helper functions for quick prompts
    const addQuickPrompt = () => {
        // Only add if there is no empty quick prompt
        const hasEmpty = quickPrompts.some(ex => !ex.label.trim() || !ex.prompt.trim());
        if (!hasEmpty) {
            setQuickPrompts([...quickPrompts, { label: "", prompt: "", tooltip: "" }]);
        }
    };

    const onChangeQuickPromptLabel = useCallback((e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const updated = [...quickPrompts];
        updated[index].label = e.currentTarget.value.trim();
        updated[index].tooltip = updated[index].label;
        setQuickPrompts(updated);
    }, [quickPrompts]);

    const onChangeQuickPromptPrompt = useCallback((e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const updated = [...quickPrompts];
        updated[index].prompt = e.currentTarget.value.trim();
        setQuickPrompts(updated);
    }, [quickPrompts]);

    const removeQuickPrompt = (index: number) => {
        setQuickPrompts(quickPrompts.filter((_, i) => i !== index));
    };

    // Helper functions for examples
    const addExample = () => {
        // Only add if there is no empty example
        const hasEmpty = examples.some(ex => !ex.text.trim() || !ex.value.trim());
        if (!hasEmpty) {
            setExamples([...examples, { text: "", value: "" }]);
        }
    };
    const onChangeExampleText = useCallback((e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const updated = [...examples];
        updated[index].text = e.currentTarget.value.trim();
        setExamples(updated);
    }, [examples]);
    const onChangeExampleValue = useCallback((e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, index: number) => {
        const updated = [...examples];
        updated[index].value = e.currentTarget.value.trim();
        setExamples(updated);
    }, [examples]);

    const removeExample = (index: number) => {
        setExamples(examples.filter((_, i) => i !== index));
    };

    // Helper functions for tools
    const handleToolsSelected = (selectedTools?: ToolInfo[]) => {
        if (selectedTools) {
            const newTools: ToolBase[] = selectedTools.map(tool => ({
                id: tool.name,
                config: {}
            }));
            setTools(newTools);
            setSelectedTools(selectedTools);
        }
        setShowToolsSelector(false);
    };

    // save bot
    const onSaveButtonClicked = useCallback(async () => {
        if (!isOwner && !botId) {
            setShowDialog(false);
            return;
        }
        // Filter out empty quick prompts
        const validQuickPrompts = quickPrompts.filter(qp =>
            qp.label && qp.label.trim() !== "" && qp.prompt && qp.prompt.trim() !== ""
        );

        // Filter out empty examples
        const validExamples = examples.filter(ex =>
            ex.text && ex.text.trim() !== "" && ex.value && ex.value.trim() !== ""
        );

        const bot: Bot = {
            id: botId,
            title: title == "" ? "Assistent" : title,
            description: description == "" ? "Ein Assistent" : description,
            system_message: systemPrompt,
            publish: publish,
            owner_ids: ownerIds,
            temperature: temperature,
            max_output_tokens: maxOutputTokens,
            quick_prompts: validQuickPrompts,
            examples: validExamples,
            version: version,
            tools: tools,
            hirachical_access: hierarchicalAccess,
            tags: tags,
        };
        setHeader(title);
        onBotChanged(bot);
        // Show saved message
        setShowSavedMessage(true);
        setTimeout(() => {
            setShowSavedMessage(false);
            setShowDialog(false);
        }, 2000);
    }, [title, description, systemPrompt, temperature, maxOutputTokens, quickPrompts, examples, version, tools, onBotChanged, setHeader, botId, isOwner, setShowDialog, publish, ownerIds, hierarchicalAccess, tags]);

    // Render saved message
    const savedMessage = useMemo(() => showSavedMessage && (
        <div className={styles.savedMessage}>
            <Checkmark24Filled />
            {t("components.edit_bot_dialog.saved_successfully")}
        </div>
    ), [showSavedMessage, t]);

    // Render stepper progress
    const stepperProgress = useMemo(() => (
        <div className={styles.stepperContainer}>
            <div className={styles.stepperHeader}>
                <div className={styles.stepNumber}>{currentStep + 1} / {totalSteps}</div>
                <div className={styles.stepTitle}>{t(stepTitles[currentStep])}</div>
            </div>
            <div className={styles.progressBar}>
                <div
                    className={styles.progressFill}
                    style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                />
            </div>
        </div>
    ), [currentStep, totalSteps, stepTitles, t]);

    // Step 0: Title
    const titleStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.bot_title")}:</label>
                <Textarea
                    placeholder={t("components.edit_bot_dialog.bot_title")}
                    value={title}
                    size="large"
                    onChange={onTitleChanged}
                    maxLength={100}
                    disabled={!isOwner || showSavedMessage}
                />
            </Field>
        </DialogContent>
    ), [title, onTitleChanged, isOwner, showSavedMessage, t]);

    // Step 1: Description
    const descriptionStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.bot_description")}:</label>
                <Textarea
                    placeholder={t("components.edit_bot_dialog.bot_description")}
                    value={description}
                    rows={15}
                    resize="vertical"
                    size="large"
                    onChange={onDescriptionChanged}
                    disabled={!isOwner || showSavedMessage}
                />
            </Field>
        </DialogContent>
    ), [description, onDescriptionChanged, isOwner, showSavedMessage, t]);

    // Step 2: System Prompt
    const systemPromptStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.system_prompt")}:</label>
                <Textarea
                    placeholder={t("components.edit_bot_dialog.system_prompt")}
                    rows={15}
                    resize="vertical"
                    value={systemPrompt}
                    size="large"
                    onChange={onPromptChanged}
                    disabled={!isOwner || showSavedMessage}
                />
            </Field>
        </DialogContent>
    ), [systemPrompt, onPromptChanged, isOwner, showSavedMessage, t]);

    // Render temperature and token controls
    const { LLM } = useContext(LLMContext);
    const min_max_tokens = 10;
    const max_max_tokens = LLM.max_output_tokens;
    const min_temp = 0;
    const max_temp = 1;

    // Temperature change
    const onTemperatureChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
        setTemperature(Number(ev.target.value));
    }, []);

    // Token change
    const onMaxtokensChange = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            const value = Number(ev.target.value);
            const maxTokens = value > LLM.max_output_tokens && LLM.max_output_tokens !== 0 ? LLM.max_output_tokens : value;
            setMaxOutputTokens(maxTokens);
        },
        [LLM.max_output_tokens]
    );

    // Step 3: Tools
    const toolsStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.tools")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {selectedTools.length > 0 ? (
                            selectedTools.map((tool, index) => (
                                <div key={tool.name + index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>{tool.name}:</span>
                                            <span className={styles.toolDescription}>{tool.description}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeFieldButton}
                                        onClick={() => {
                                            const newTools = tools.filter(t => t.id !== tool.name);
                                            setTools(newTools);
                                            const newSelectedTools = selectedTools.filter(t => t.name !== tool.name);
                                            setSelectedTools(newSelectedTools);
                                        }}
                                        disabled={!isOwner}
                                        title={t("components.edit_bot_dialog.remove")}
                                    >
                                        <Delete24Regular />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_tools_selected")}</div>
                        )}
                    </div>
                    {!!isOwner &&
                        <Button
                            appearance="subtle"
                            onClick={() => setShowToolsSelector(true)}
                            disabled={!isOwner}
                            className={styles.addFieldButton}
                        >
                            <Add24Regular /> {t("components.edit_bot_dialog.select_tools")}
                        </Button>}
                </div>
            </Field>
        </DialogContent>
    ), [selectedTools, tools, isOwner, t]);

    // Step 4: Quick Prompts
    const quickPromptsStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.quick_prompts")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {quickPrompts.length > 0 ? (
                            quickPrompts.map((qp, index) => (
                                <div key={index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Label:</span>
                                            <Input
                                                placeholder={t("components.edit_bot_dialog.quick_prompt_label_placeholder")}
                                                value={qp.label}
                                                onChange={(e) => onChangeQuickPromptLabel(e, index)}
                                                disabled={!isOwner}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Prompt:</span>
                                            <Textarea
                                                placeholder={t("components.edit_bot_dialog.quick_prompt_text_placeholder")}
                                                value={qp.prompt}
                                                onChange={(e) => onChangeQuickPromptPrompt(e, index)}
                                                disabled={!isOwner}
                                                rows={2}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                    </div>
                                    {!!isOwner && (
                                        <button
                                            className={styles.removeFieldButton}
                                            onClick={() => removeQuickPrompt(index)}
                                            disabled={!isOwner}
                                            title={t("components.edit_bot_dialog.remove")}
                                        >
                                            <Delete24Regular />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_quick_prompts_selected")}</div>
                        )}
                    </div>
                    {!!isOwner &&
                        <Button
                            appearance="subtle"
                            onClick={addQuickPrompt}
                            disabled={!isOwner}
                            className={styles.addFieldButton}
                        >
                            <Add24Regular /> {t("components.edit_bot_dialog.add_quick_prompt")}
                        </Button>}
                </div>
            </Field>
        </DialogContent>
    ), [quickPrompts, isOwner, t]);

    // Step 5: Examples
    const examplesStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.examples")}</label>
                <div className={styles.dynamicFieldContainer}>
                    <div className={styles.dynamicFieldList}>
                        {examples.length > 0 ? (
                            examples.map((ex, index) => (
                                <div key={index} className={styles.dynamicFieldItem}>
                                    <div className={styles.dynamicFieldInputs}>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Text:</span>
                                            <Input
                                                placeholder={t("components.edit_bot_dialog.example_text_placeholder")}
                                                value={ex.text}
                                                onChange={(e) => onChangeExampleText(e, index)}
                                                disabled={!isOwner}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                        <div className={styles.dynamicFieldInputRow}>
                                            <span className={styles.dynamicFieldInputLabel}>Value:</span>
                                            <Textarea
                                                placeholder={t("components.edit_bot_dialog.example_value_placeholder")}
                                                value={ex.value}
                                                onChange={(e) => onChangeExampleValue(e, index)}
                                                disabled={!isOwner}
                                                rows={2}
                                                className={styles.dynamicFieldInput}
                                            />
                                        </div>
                                    </div>
                                    {!!isOwner && (
                                        <button
                                            className={styles.removeFieldButton}
                                            onClick={() => removeExample(index)}
                                            disabled={!isOwner}
                                            title={t("components.edit_bot_dialog.remove")}
                                        >
                                            <Delete24Regular />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.noToolsText}>{t("components.edit_bot_dialog.no_examples_selected")}</div>
                        )}
                    </div>
                    {!!isOwner && (
                        <Button
                            appearance="subtle"
                            onClick={addExample}
                            disabled={!isOwner}
                            className={styles.addFieldButton}
                        >
                            <Add24Regular /> {t("components.edit_bot_dialog.add_example")}
                        </Button>
                    )}
                </div>
            </Field>
        </DialogContent>
    ), [examples, isOwner, t]);

    // Step 6: Advanced Settings (Temperature and Tokens)
    const advancedSettingsStep = useMemo(() => (
        <DialogContent>
            <Field size="large" className={styles.rangeField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.temperature")}</label>
                <input
                    type="range"
                    min={min_temp}
                    max={max_temp}
                    step={0.05}
                    value={temperature}
                    onChange={onTemperatureChange}
                    disabled={!isOwner}
                    className={styles.rangeInput}
                />
                <div className={styles.rangeValue}>{temperature}</div>
            </Field>
            <Field size="large" className={styles.rangeField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.max_output_tokens")}</label>
                <input
                    type="range"
                    min={min_max_tokens}
                    max={max_max_tokens}
                    step={100}
                    value={maxOutputTokens}
                    onChange={onMaxtokensChange}
                    disabled={!isOwner}
                    className={styles.rangeInput}
                />
                <div className={styles.rangeValue}>{maxOutputTokens}</div>
            </Field>
        </DialogContent>
    ), [temperature, maxOutputTokens, onTemperatureChange, onMaxtokensChange, isOwner, t, min_temp, max_temp, min_max_tokens, max_max_tokens]);

    // Function to render current step content
    const getCurrentStepContent = () => {
        switch (currentStep) {
            case 0:
                return titleStep;
            case 1:
                return descriptionStep;
            case 2:
                return systemPromptStep;
            case 3:
                return toolsStep;
            case 4:
                return quickPromptsStep;
            case 5:
                return examplesStep;
            case 6:
                return advancedSettingsStep;
            default:
                return titleStep;
        }
    };

    // Render dialog actions
    const dialogActions = useMemo(() => (
        <>
            <Button
                appearance="secondary"
                size="small"
                onClick={prevStep}
                disabled={currentStep === 0 || showSavedMessage}
            >
                <ChevronLeft24Regular /> {t("components.edit_bot_dialog.previous")}
            </Button>
            <Button
                appearance="secondary"
                size="small"
                onClick={onSaveButtonClicked}
                disabled={showSavedMessage}
            >
                {!isOwner ? <Dismiss24Regular /> : <Save24Filled />}
                {" "}
                {!isOwner ? t("components.edit_bot_dialog.close") : t("components.edit_bot_dialog.save")}
            </Button>
            <Button
                appearance="primary"
                size="small"
                onClick={nextStep}
                disabled={!canProceedToNext() || showSavedMessage || currentStep === totalSteps - 1}
            >
                {t("components.edit_bot_dialog.next")} <ChevronRight24Regular />
            </Button>
        </>
    ), [currentStep, totalSteps, prevStep, nextStep, canProceedToNext, onSaveButtonClicked, isOwner, showSavedMessage, t]);


    return (
        <div>
            <Dialog modalType="alert" open={showDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogTitle>{t("components.edit_bot_dialog.title")}</DialogTitle>
                    {!showSavedMessage && (
                        <div className={styles.stepperFullWidth}>
                            {stepperProgress}
                        </div>
                    )}
                    <DialogBody className={styles.scrollableDialogContent}>
                        {savedMessage}
                        {!showSavedMessage && getCurrentStepContent()}
                    </DialogBody>
                    <DialogActions className={styles.dialogActionsContainer}>
                        <div className={styles.stepperActions}>
                            {dialogActions}
                        </div>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
            <ToolsSelector
                open={showToolsSelector}
                onClose={handleToolsSelected}
                tools={availableTools}
                selectedTools={selectedTools}
            />
        </div>
    );
};
