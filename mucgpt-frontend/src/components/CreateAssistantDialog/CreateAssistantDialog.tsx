import { Checkmark24Filled, Dismiss24Regular } from "@fluentui/react-icons";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    InfoLabel,
    Textarea,
    TextareaOnChangeData,
} from "@fluentui/react-components";

import styles from "./CreateAssistantDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { Assistant } from "../../api";
import { ASSISTANT_STORE, DEFAULT_MAX_OUTPUT_TOKENS } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { createAssistantApi } from "../../api/core-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import { Stepper, Step } from "../Stepper";

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

type DialogStep = 1 | 2;

export const CreateAssistantDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [currentStep, setCurrentStep] = useState<DialogStep>(1);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");

    // Context
    const { LLM } = useContext(LLMContext);
    const llmMaxOutputTokens = LLM.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const { showError, showSuccess } = useGlobalToastContext();

    const { t } = useTranslation();

    const storageService: AssistantStorageService = new AssistantStorageService(ASSISTANT_STORE);

    // input change
    const onInputChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setInput(newValue.value);
        } else {
            setInput("");
        }
        // Reset template selection when user types manually
        setSelectedTemplate("");
    }, []);

    // description change
    const onDescriptionChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        setDescription(newValue?.value ?? "");
    }, []);

    // title change
    const onTitleChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        setTitle(newValue?.value ?? "");
    }, []);

    // system prompt change
    const onRefinedPromptChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        setSystemPrompt(newValue?.value ?? "");
    }, []);

    // save assistant
    const onPromptButtonClicked = useCallback(async () => {
        try {
            const assistant: Assistant = {
                title: title === "" ? "Assistent" : title,
                description: description === "" ? "Ein Assistent" : description,
                system_message: systemPrompt,
                publish: false,
                temperature: 0.6,
                max_output_tokens: llmMaxOutputTokens,
                quick_prompts: [],
                examples: [],
                version: "0",
                owner_ids: [],
                tags: [],
                hierarchical_access: [],
                tools: [],
                is_visible: true
            };
            const created_id = await storageService.createAssistantConfig(assistant);
            if (created_id) {
                showSuccess(
                    t("components.create_assistant_dialog.assistant_saved_success"),
                    t("components.create_assistant_dialog.assistant_saved_message", { title: assistant.title })
                );
                window.location.href = import.meta.env.BASE_URL + "#assistant/" + created_id;
            } else {
                console.error("Assistant could not be created");
                showError(t("components.create_assistant_dialog.assistant_creation_failed"), t("components.create_assistant_dialog.save_config_failed"));
            }
        } catch (error) {
            console.error("Failed to save assistant", error);
            const errorMessage = error instanceof Error ? error.message : t("components.create_assistant_dialog.save_assistant_failed");
            showError(t("components.create_assistant_dialog.assistant_save_failed"), errorMessage);
        }
    }, [title, description, systemPrompt, llmMaxOutputTokens, storageService, showError, showSuccess, t]);

    // cancel button clicked
    const onCancelButtonClicked = useCallback(() => {
        setShowDialogInput(false);
        setInput("");
        setCurrentStep(1);
        setSystemPrompt("");
        setDescription("");
        setTitle("");
        setSelectedTemplate("");
    }, [setShowDialogInput]);

    // call Assistant api
    const createAssistant = useCallback(async () => {
        if (input !== "") {
            setLoading(true);
            try {
                const result = await (await createAssistantApi({ input: input, model: LLM.llm_name, max_output_tokens: llmMaxOutputTokens })).json();
                setSystemPrompt(result.system_prompt);
                setDescription(result.description);
                setTitle(result.title);
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
    }, [input, LLM.llm_name, llmMaxOutputTokens, showError, showSuccess, t]);

    const handleTemplateSelect = useCallback(
        (template: string, templateId: string) => {
            // Toggle functionality: if already selected, deselect it
            if (selectedTemplate === templateId) {
                setInput("");
                setSelectedTemplate("");
            } else {
                setInput(template);
                setSelectedTemplate(templateId);
            }
        },
        [selectedTemplate]
    );

    const handleContinueWithMucGPT = useCallback(async () => {
        await createAssistant();
    }, [createAssistant]);

    const handleDefineMyself = useCallback(() => {
        setDescription(input);
        setCurrentStep(2);
    }, [input]);

    const steps: Step[] = [
        {
            label: t("components.create_assistant_dialog.step1_label"),
            completedIcon: <Checkmark24Filled />
        },
        {
            label: t("components.create_assistant_dialog.step2_label")
        }
    ];

    const renderStep1 = () => (
        <>
            <DialogContent>
                <Stepper steps={steps} currentStep={currentStep} />

                <p className={styles.hintText}>{t("components.create_assistant_dialog.hint_text")}</p>

                <Field size="large" className={styles.fieldSection}>
                    <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.description")}: *</label>
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
                    <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.or_choose_template")}</label>
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
            <DialogActions className={styles.dialogActions}>
                <Button disabled={loading || input === ""} size="medium" onClick={handleDefineMyself} className={styles.defineButton}>
                    {t("components.create_assistant_dialog.define_myself")}
                </Button>
                <Button disabled={loading || input === ""} size="medium" onClick={handleContinueWithMucGPT} className={styles.continueButton}>
                    {t("components.create_assistant_dialog.continue_with_mucgpt")}
                </Button>
            </DialogActions>
        </>
    );

    const renderStep2 = () => (
        <>
            <DialogContent>
                <Stepper steps={steps} currentStep={currentStep} />

                <p className={styles.hintText}>{t("components.create_assistant_dialog.hint_text_step2")}</p>

                <Field size="large" className={styles.fieldSection}>
                    <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.title")}:</label>
                    <Textarea
                        placeholder={t("components.create_assistant_dialog.title_placeholder")}
                        value={title}
                        size="large"
                        rows={1}
                        resize="vertical"
                        onChange={onTitleChanged}
                        maxLength={100}
                    />
                </Field>
                <Field size="large" className={styles.fieldSection}>
                    <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.description")}:</label>
                    <Textarea
                        placeholder={t("components.create_assistant_dialog.description_placeholder")}
                        value={description}
                        size="large"
                        rows={3}
                        resize="vertical"
                        onChange={onDescriptionChanged}
                    />
                </Field>
                <Field size="large" className={styles.fieldSection}>
                    <label className={styles.fieldLabel}>
                        {t("components.create_assistant_dialog.prompt")}:
                        <InfoLabel
                            info={
                                <div>
                                    <i>{t("components.chattsettingsdrawer.system_prompt")}s </i>
                                    {t("components.chattsettingsdrawer.system_prompt_info")}
                                </div>
                            }
                        />
                    </label>
                    <Textarea
                        placeholder={t("components.create_assistant_dialog.prompt_placeholder")}
                        rows={7}
                        resize="vertical"
                        value={systemPrompt}
                        size="large"
                        onChange={onRefinedPromptChanged}
                    />
                </Field>
            </DialogContent>
            <DialogActions className={styles.dialogActions}>
                <Button size="medium" onClick={() => setCurrentStep(1)} className={styles.backButton}>
                    {t("common.back")}
                </Button>
                <Button size="medium" onClick={onCancelButtonClicked} className={styles.cancelButton}>
                    {t("common.cancel")}
                </Button>
                <Button
                    size="medium"
                    onClick={onPromptButtonClicked}
                    className={styles.createButton}
                    disabled={title.trim() === "" || description.trim() === "" || systemPrompt.trim() === ""}
                >
                    {t("common.create")}
                </Button>
            </DialogActions>
        </>
    );

    return (
        <div>
            <Dialog modalType="modal" open={showDialogInput} onOpenChange={(_event, data) => setShowDialogInput(data.open)}>
                <DialogSurface className={styles.dialog}>
                    <div className={styles.dialogHeader}>
                        <DialogTitle className={styles.dialogTitle}>{t("components.create_assistant_dialog.dialog_title")}</DialogTitle>
                        <Button
                            appearance="subtle"
                            size="small"
                            onClick={onCancelButtonClicked}
                            className={styles.closeButton}
                            icon={<Dismiss24Regular />}
                        />
                    </div>
                    <DialogBody className={styles.dialogContent}>{currentStep === 1 ? renderStep1() : renderStep2()}</DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
