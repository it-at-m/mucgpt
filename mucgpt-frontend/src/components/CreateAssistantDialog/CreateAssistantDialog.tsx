import { ArrowRight24Regular, Checkmark24Filled, Dismiss24Regular, EditArrowBack24Regular } from "@fluentui/react-icons";
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
    TextareaOnChangeData
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

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

export const CreateAssistantDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [showOutputView, setShowOutputView] = useState<boolean>(false);

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
    }, []);

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
    const onRefinedPromptChanged = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setSystemPrompt(newValue.value);
        } else {
            setSystemPrompt("");
        }
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

    // back button clicked
    const onBackButtonClicked = useCallback(() => {
        setShowOutputView(false);
        setSystemPrompt("");
        setDescription("");
        setTitle("");
    }, []);

    // cancel button clicked
    const onCancelButtonClicked = useCallback(() => {
        setShowDialogInput(false);
        setInput("");
        setShowOutputView(false);
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
                setShowOutputView(true);
                // Keep dialog open
                setShowDialogInput(true);
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
    }, [input, LLM.llm_name, llmMaxOutputTokens, showError, showSuccess, t, setShowDialogInput]);

    const manuelAssistantCreation = useCallback(() => {
        setShowOutputView(true);
        // Keep dialog open
        setShowDialogInput(true);
        setInput("");
    }, [setShowDialogInput]);

    const renderInputView = () => (
        <>
            <DialogTitle>{t("components.create_assistant_dialog.what_function")}</DialogTitle>
            <DialogContent>
                <div className={styles.exampleList}>
                    <Button
                        disabled={loading}
                        className={styles.exampleBox}
                        onClick={() => setInput(t("components.create_assistant_dialog.create_example_one"))}
                    >
                        {t("components.create_assistant_dialog.example_one")}
                    </Button>
                    <Button
                        disabled={loading}
                        className={styles.exampleBox}
                        onClick={() => setInput(t("components.create_assistant_dialog.create_example_two"))}
                    >
                        {t("components.create_assistant_dialog.example_two")}
                    </Button>
                    <Button
                        disabled={loading}
                        className={styles.exampleBox}
                        onClick={() => setInput(t("components.create_assistant_dialog.create_example_three"))}
                    >
                        {t("components.create_assistant_dialog.example_three")}
                    </Button>
                </div>
                <Field size="large">
                    <Textarea
                        placeholder={t("components.create_assistant_dialog.describe")}
                        size="large"
                        rows={10}
                        required
                        value={input}
                        onChange={onInputChanged}
                        disabled={loading}
                    />
                    <br />
                    <p hidden={!loading}>{t("components.create_assistant_dialog.generating_prompt")}</p>
                </Field>
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                    <Dismiss24Regular /> {t("components.create_assistant_dialog.dismiss")}
                </Button>
                <Button disabled={loading || input === ""} appearance="secondary" size="small" onClick={createAssistant}>
                    <Checkmark24Filled /> {t("components.create_assistant_dialog.create")}
                </Button>
                <Button disabled={loading} appearance="secondary" size="small" onClick={manuelAssistantCreation}>
                    <ArrowRight24Regular /> {t("components.create_assistant_dialog.skip")}
                </Button>
            </DialogActions>
        </>
    );

    const renderOutputView = () => (
        <>
            <DialogTitle>{t("components.create_assistant_dialog.prompt_title_desc")}</DialogTitle>
            <DialogContent>
                <Field size="large">
                    {t("create_assistant.title")}:
                    <Textarea placeholder={t("create_assistant.title")} value={title} size="large" onChange={onTitleChanged} maxLength={100} />
                </Field>
                <Field size="large">
                    {t("create_assistant.description")}:
                    <Textarea placeholder={t("create_assistant.description")} value={description} size="large" onChange={onDescriptionChanged} />
                </Field>
                <Field size="large">
                    {t("create_assistant.prompt")}:
                    <Textarea placeholder={t("create_assistant.prompt")} rows={10} value={systemPrompt} size="large" onChange={onRefinedPromptChanged} />
                </Field>
            </DialogContent>
            <DialogActions>
                <Button appearance="secondary" size="small" onClick={onBackButtonClicked}>
                    <EditArrowBack24Regular /> {t("components.create_assistant_dialog.back")}
                </Button>
                <Button appearance="secondary" size="small" onClick={onPromptButtonClicked}>
                    <Checkmark24Filled /> {t("components.create_assistant_dialog.save")}
                </Button>
            </DialogActions>
        </>
    );

    return (
        <div>
            <Dialog modalType={"non-modal"} open={showDialogInput} onOpenChange={(_event, data) => setShowDialogInput(data.open)}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>{showOutputView ? renderOutputView() : renderInputView()}</DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
