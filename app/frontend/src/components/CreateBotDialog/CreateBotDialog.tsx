import { Checkmark24Filled, Dismiss24Regular, EditArrowBack24Regular } from "@fluentui/react-icons";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Field,
    Textarea,
    TextareaOnChangeData
} from "@fluentui/react-components";

import styles from "./CreateBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { useContext, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { Bot, createBotApi } from "../../api";
import { BOT_STORE, CREATE_BOT_EXAMPLE_1, CREATE_BOT_EXAMPLE_2, CREATE_BOT_EXAMPLE_3 } from "../../constants";
import { BotStorageService } from "../../service/botstorage";

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

export const CreateBotDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const { LLM } = useContext(LLMContext);
    const [title, setTitle] = useState<string>("");
    const [showDialogOutput, setShowDialogOutput] = useState<boolean>(false);

    const { t } = useTranslation();
    const storageService: BotStorageService = new BotStorageService(BOT_STORE);

    const onInputChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setInput(newValue.value);
        } else {
            setInput("");
        }
    };

    const onDescriptionChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setDescription(newValue.value);
        } else {
            setDescription("");
        }
    };

    const onTitleChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setTitle(newValue.value);
        } else {
            setTitle("Assistent");
        }
    };

    const onRefinedPromptChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setSystemPrompt(newValue.value);
        } else {
            setSystemPrompt("");
        }
    };

    const onPromptButtonClicked = async () => {
        const bot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: false,
            temperature: 0.6,
            max_output_tokens: LLM.max_output_tokens
        };
        const created_id = await storageService.createBotConfig(bot);
        if (created_id) window.location.href = "/#/bot/" + created_id;
        else console.error("Bot could not be created");
    };

    const onBackButtonClicked = () => {
        setShowDialogOutput(false);
        setShowDialogInput(true);
        setSystemPrompt("");
        setDescription("");
        setTitle("");
    };

    const onCancelButtonClicked = () => {
        setShowDialogInput(false);
        setInput("");
    };

    const createBot = async () => {
        if (input != "") {
            setLoading(true);
            const result = await (await createBotApi({ input: input, model: "gpt-4o", max_output_tokens: LLM.max_output_tokens })).json();
            setSystemPrompt(result.system_prompt);
            setDescription(result.description);
            setTitle(result.title);
            setLoading(false);
            setShowDialogOutput(true);
            setShowDialogInput(false);
        }
    };

    return (
        <div>
            <Dialog modalType="alert" defaultOpen={false} open={showDialogInput}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
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
                            <DialogTrigger disableButtonEnhancement>
                                <Button disabled={loading} appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                                    <Dismiss24Regular /> {t("components.create_bot_dialog.dismiss")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button disabled={loading} appearance="secondary" size="small" onClick={createBot}>
                                    <Checkmark24Filled /> {t("components.create_bot_dialog.create")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <Dialog modalType="alert" defaultOpen={false} open={showDialogOutput}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
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
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={onBackButtonClicked}>
                                    <EditArrowBack24Regular /> {t("components.create_bot_dialog.back")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={onPromptButtonClicked}>
                                    <Checkmark24Filled /> {t("components.create_bot_dialog.save")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
