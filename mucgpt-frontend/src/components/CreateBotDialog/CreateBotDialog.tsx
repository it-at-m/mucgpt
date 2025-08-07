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

import styles from "./CreateBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { Bot } from "../../api";
import { BOT_STORE, CREATE_BOT_EXAMPLE_1, CREATE_BOT_EXAMPLE_2, CREATE_BOT_EXAMPLE_3 } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { createBotApi } from "../../api/core-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

export const CreateBotDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [showOutputView, setShowOutputView] = useState<boolean>(false);

    // Context
    const { LLM } = useContext(LLMContext);
    const { showError, showSuccess } = useGlobalToastContext();

    const { t } = useTranslation();

    const storageService: BotStorageService = new BotStorageService(BOT_STORE);

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

    // save bot
    const onPromptButtonClicked = useCallback(async () => {
        try {
            const bot: Bot = {
                title: title === "" ? "Assistent" : title,
                description: description === "" ? "Ein Assistent" : description,
                system_message: systemPrompt,
                publish: false,
                temperature: 0.6,
                max_output_tokens: LLM.max_output_tokens,
                quick_prompts: [],
                examples: [],
                version: "0"
            };
            const created_id = await storageService.createBotConfig(bot);
            if (created_id) {
                showSuccess(t("components.create_bot_dialog.bot_saved_success"), t("components.create_bot_dialog.bot_saved_message", { title: bot.title }));
                window.location.href = import.meta.env.BASE_URL + "#bot/" + created_id;
            } else {
                console.error("Bot could not be created");
                showError(t("components.create_bot_dialog.bot_creation_failed"), t("components.create_bot_dialog.save_config_failed"));
            }
        } catch (error) {
            console.error("Failed to save bot", error);
            const errorMessage = error instanceof Error ? error.message : t("components.create_bot_dialog.save_bot_failed");
            showError(t("components.create_bot_dialog.bot_save_failed"), errorMessage);
        }
    }, [title, description, systemPrompt, LLM.max_output_tokens, storageService, showError, showSuccess, t]);

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

    // call Bot api
    const createBot = useCallback(async () => {
        if (input !== "") {
            setLoading(true);
            try {
                const result = await (await createBotApi({ input: input, model: LLM.llm_name, max_output_tokens: LLM.max_output_tokens })).json();
                setSystemPrompt(result.system_prompt);
                setDescription(result.description);
                setTitle(result.title);
                setShowOutputView(true);
                // Keep dialog open
                setShowDialogInput(true);
                showSuccess(t("components.create_bot_dialog.bot_generated_success"), t("components.create_bot_dialog.bot_generated_message"));
            } catch (error) {
                console.error("Failed to create bot", error);
                const errorMessage = error instanceof Error ? error.message : t("components.create_bot_dialog.bot_generation_failed");
                showError(t("components.create_bot_dialog.bot_creation_failed"), errorMessage);
            } finally {
                setLoading(false);
            }
        }
    }, [input, LLM.llm_name, LLM.max_output_tokens, showError, showSuccess, t, setShowDialogInput]);

    const manuelBotCreation = useCallback(() => {
        setShowOutputView(true);
        // Keep dialog open
        setShowDialogInput(true);
        setInput("");
    }, [setShowDialogInput]);

    const renderInputView = () => (
        <>
            <DialogTitle>{t("components.create_bot_dialog.what_function")}</DialogTitle>
            <DialogContent>
                <div className={styles.exampleList}>
                    <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(CREATE_BOT_EXAMPLE_1)}>
                        Beispiel 1: Übersetzer
                    </Button>
                    <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(CREATE_BOT_EXAMPLE_2)}>
                        Beispiel 2: Email
                    </Button>
                    <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(CREATE_BOT_EXAMPLE_3)}>
                        Beispiel 3: Synonyme
                    </Button>
                </div>
                <Field size="large">
                    <Textarea
                        placeholder={t("components.create_bot_dialog.describe")}
                        size="large"
                        rows={10}
                        required
                        value={input}
                        onChange={onInputChanged}
                        disabled={loading}
                    />
                    <br />
                    <p hidden={!loading}>{t("components.create_bot_dialog.generating_prompt")}</p>
                </Field>
            </DialogContent>
            <DialogActions>
                <Button disabled={loading} appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                    <Dismiss24Regular /> {t("components.create_bot_dialog.dismiss")}
                </Button>
                <Button disabled={loading || input === ""} appearance="secondary" size="small" onClick={createBot}>
                    <Checkmark24Filled /> {t("components.create_bot_dialog.create")}
                </Button>
                <Button disabled={loading} appearance="secondary" size="small" onClick={manuelBotCreation}>
                    <ArrowRight24Regular /> {t("components.create_bot_dialog.skip")}
                </Button>
            </DialogActions>
        </>
    );

    const renderOutputView = () => (
        <>
            <DialogTitle>{t("components.create_bot_dialog.prompt_title_desc")}</DialogTitle>
            <DialogContent>
                <Field size="large">
                    {t("create_bot.title")}:
                    <Textarea placeholder={t("create_bot.title")} value={title} size="large" onChange={onTitleChanged} maxLength={100} />
                </Field>
                <Field size="large">
                    {t("create_bot.description")}:
                    <Textarea placeholder={t("create_bot.description")} value={description} size="large" onChange={onDescriptionChanged} />
                </Field>
                <Field size="large">
                    {t("create_bot.prompt")}:
                    <Textarea placeholder={t("create_bot.prompt")} rows={10} value={systemPrompt} size="large" onChange={onRefinedPromptChanged} />
                </Field>
            </DialogContent>
            <DialogActions>
                <Button appearance="secondary" size="small" onClick={onBackButtonClicked}>
                    <EditArrowBack24Regular /> {t("components.create_bot_dialog.back")}
                </Button>
                <Button appearance="secondary" size="small" onClick={onPromptButtonClicked}>
                    <Checkmark24Filled /> {t("components.create_bot_dialog.save")}
                </Button>
            </DialogActions>
        </>
    );

    return (
        <div>
            <Dialog modalType={"non-modal"} open={showDialogInput}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>{showOutputView ? renderOutputView() : renderInputView()}</DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
