import { Delete24Regular, Dismiss24Regular, Edit24Regular, Save24Regular, ChatSettings24Regular, Checkmark24Filled } from "@fluentui/react-icons";
import {
    Button,
    Slider,
    Label,
    useId,
    SliderProps,
    Field,
    InfoLabel,
    Tooltip,
    Textarea,
    TextareaOnChangeData,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger
} from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { ReactNode, SetStateAction, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Sidebar } from "../Sidebar/Sidebar";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { Bot } from "../../api";

interface Props {
    bot: Bot;
    onBotChange: (bot: Bot) => void;
    onDeleteBot: () => void;
    actions: ReactNode;
    before_content: ReactNode;
    onEditChange: (isEditable: boolean) => void;
    minimized: boolean;
}

export const BotsettingsDrawer = ({ bot, onBotChange, onDeleteBot, actions, before_content, onEditChange, minimized }: Props) => {
    const [isEditable, setEditable] = useState(false);
    const { t } = useTranslation();
    const { LLM } = useContext(LLMContext);

    const temperature_headerID = useId("header-temperature");
    const temperatureID = useId("input-temperature");
    const max_tokens_headerID = useId("header-max_tokens");
    const max_tokensID = useId("input-max_tokens");

    const min_max_tokens = 10;
    const max_max_tokens = LLM.max_output_tokens;
    const min_temp = 0;
    const max_temp = 1;

    const [temperature, setTemperature] = useState(bot.temperature);
    const [max_output_tokens, setMaxOutputTokens] = useState(bot.max_output_tokens);
    const [systemPrompt, setSystemPrompt] = useState<string>(bot.system_message);
    const [title, setTitle] = useState<string>(bot.title);
    const [description, setDescription] = useState<string>(bot.description);
    const [publish, setPublish] = useState<boolean>(bot.publish);
    const [isOwner, setIsOwner] = useState<boolean>(!bot.publish);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);

    useEffect(() => {
        setMaxOutputTokens(bot.max_output_tokens);
        setSystemPrompt(bot.system_message);
        setTitle(bot.title);
        setDescription(bot.description);
        setPublish(bot.publish);
        setTemperature(bot.temperature);
        setIsOwner(!bot.publish);
    }, [bot]);

    // Temperature change
    const onTemperatureChange: SliderProps["onChange"] = useCallback((_: any, data: { value: SetStateAction<number> }) => {
        setTemperature(data.value);
    }, []);

    // Token change
    const onMaxtokensChange: SliderProps["onChange"] = useCallback(
        (_: any, data: { value: number }) => {
            const maxTokens = data.value > LLM.max_output_tokens && LLM.max_output_tokens != 0 ? LLM.max_output_tokens : data.value;
            setMaxOutputTokens(maxTokens);
        },
        [LLM.max_output_tokens]
    );

    // System prompt change
    const onSytemPromptChange = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setSystemPrompt(newValue.value);
        else setSystemPrompt("");
    }, []);

    // Title change
    const onTitleChange = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setTitle(newValue.value);
        else setTitle("");
    }, []);

    // Description change
    const onDescriptionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setDescription(newValue.value);
        else setDescription("");
    };

    // Toggle read-only mode
    const toggleReadOnly = useCallback(() => {
        setEditable(!isEditable);
        onEditChange(!isEditable);
        if (isEditable && isOwner) {
            const updatedTitle = title.trim() !== "" ? title : `Assistent ${bot.id}`;
            setTitle(updatedTitle);
            const updatedBot = {
                ...bot,
                temperature,
                max_output_tokens,
                system_message: systemPrompt,
                title: updatedTitle,
                description,
                publish
            };
            onBotChange(updatedBot);
            window.location.reload();
        }
    }, [isEditable, isOwner, bot, temperature, max_output_tokens, systemPrompt, title, description, publish, onEditChange, onBotChange]);

    // clear system prompt
    const onClearSystemPrompt = useCallback(() => {
        setSystemPrompt("");
    }, []);

    // Delete bot confirmation dialog
    const deleteDialog = useMemo(
        () => (
            <Dialog modalType="alert" open={showDeleteDialog}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>{t("components.botsettingsdrawer.deleteDialog.title")}</DialogTitle>
                        <DialogContent>{t("components.botsettingsdrawer.deleteDialog.content")}</DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={() => setShowDeleteDialog(false)}>
                                    <Dismiss24Regular /> {t("components.botsettingsdrawer.deleteDialog.cancel")}
                                </Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="secondary"
                                    size="small"
                                    onClick={() => {
                                        setShowDeleteDialog(false);
                                        onDeleteBot();
                                    }}
                                >
                                    <Checkmark24Filled /> {t("components.botsettingsdrawer.deleteDialog.confirm")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        ),
        [showDeleteDialog, onDeleteBot]
    );

    // actions component
    const actions_component = useMemo(
        () => (
            <div>
                <div className={styles.actionRow}> {actions}</div>
                {!minimized && (
                    <div className={styles.actionRow}>
                        {deleteDialog}
                        <Button
                            appearance="secondary"
                            icon={
                                isOwner ? (
                                    isEditable ? (
                                        <Save24Regular className={styles.iconRightMargin} />
                                    ) : (
                                        <Edit24Regular className={styles.iconRightMargin} />
                                    )
                                ) : isEditable ? (
                                    <Dismiss24Regular className={styles.iconRightMargin} />
                                ) : (
                                    <ChatSettings24Regular className={styles.iconRightMargin} />
                                )
                            }
                            onClick={toggleReadOnly}
                        >
                            {isOwner
                                ? isEditable
                                    ? t("components.botsettingsdrawer.finish_edit")
                                    : t("components.botsettingsdrawer.edit")
                                : isEditable
                                  ? t("components.botsettingsdrawer.close_configutations")
                                  : t("components.botsettingsdrawer.show_configutations")}
                        </Button>
                        <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                            <Button
                                appearance="secondary"
                                onClick={() => setShowDeleteDialog(true)}
                                icon={<Delete24Regular className={styles.iconRightMargin} />}
                                disabled={!isOwner}
                            >
                                {t("components.botsettingsdrawer.delete")}
                            </Button>
                        </Tooltip>
                    </div>
                )}
            </div>
        ),
        [actions, isEditable, isOwner, toggleReadOnly, t, deleteDialog, minimized]
    );

    // sidebar content
    const content = (
        <>
            <>{before_content}</>{" "}
            {isEditable && (
                <div className={styles.header} role="heading" aria-level={3}>
                    <div className={styles.systemPromptHeadingContainer}>{t("create_bot.title")}</div>
                </div>
            )}
            {isEditable && (
                <div className={styles.bodyContainer}>
                    <div>
                        <Field size="small">
                            {
                                <Textarea
                                    textarea={styles.systempromptTextArea}
                                    placeholder={t("create_bot.title")}
                                    value={title}
                                    size="large"
                                    rows={1}
                                    maxLength={50}
                                    onChange={onTitleChange}
                                    disabled={!isOwner}
                                />
                            }
                        </Field>
                    </div>
                </div>
            )}
            {isEditable && (
                <div className={styles.header} role="heading" aria-level={3}>
                    <div className={styles.systemPromptHeadingContainer}>{t("create_bot.description")}</div>
                </div>
            )}
            <div className={styles.bodyContainer}>
                <div>
                    <Field size="large">
                        {isEditable ? (
                            <Textarea
                                textarea={styles.systempromptTextArea}
                                placeholder={t("create_bot.description")}
                                value={description}
                                size="large"
                                rows={15}
                                onChange={onDescriptionChange}
                                disabled={!isOwner}
                            />
                        ) : (
                            <Markdown
                                className={styles.markdownDescription}
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    code: CodeBlockRenderer
                                }}
                            >
                                {description}
                            </Markdown>
                        )}
                    </Field>
                </div>
            </div>
            {isEditable && (
                <>
                    <div className={styles.header} role="heading" aria-level={3}>
                        <div className={styles.systemPromptHeadingContainer}>
                            <InfoLabel
                                info={
                                    <div>
                                        <i>{t("components.chattsettingsdrawer.system_prompt")}s </i>
                                        {t("components.chattsettingsdrawer.system_prompt_info")}
                                    </div>
                                }
                            >
                                {t("components.chattsettingsdrawer.system_prompt")}
                            </InfoLabel>
                            {isEditable && (
                                <Tooltip content={t("components.chattsettingsdrawer.system_prompt_clear")} relationship="description" positioning="below">
                                    <Button
                                        aria-label={t("components.chattsettingsdrawer.system_prompt_clear")}
                                        icon={<Dismiss24Regular />}
                                        appearance="subtle"
                                        onClick={onClearSystemPrompt}
                                        size="small"
                                        disabled={!isOwner}
                                    ></Button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    <div className={styles.bodyContainer}>
                        <div>
                            <Field size="large">
                                <Textarea
                                    textarea={styles.systempromptTextArea}
                                    placeholder={t("components.chattsettingsdrawer.system_prompt")}
                                    resize="vertical"
                                    value={systemPrompt}
                                    size="large"
                                    rows={15}
                                    onChange={onSytemPromptChange}
                                    disabled={!isOwner}
                                />
                            </Field>
                            {!isEditable && (
                                <Markdown
                                    className={styles.markdownDescription}
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        code: CodeBlockRenderer
                                    }}
                                >
                                    {systemPrompt}
                                </Markdown>
                            )}
                        </div>
                    </div>
                    <div className={styles.header} role="heading" aria-level={3} id={max_tokens_headerID}>
                        <InfoLabel info={<div>{t("components.chattsettingsdrawer.max_lenght_info")}</div>}>
                            {t("components.chattsettingsdrawer.max_lenght")}
                        </InfoLabel>
                    </div>
                    <div className={styles.bodyContainer}>
                        <div className={styles.verticalContainer}>
                            <Slider
                                min={min_max_tokens}
                                max={max_max_tokens}
                                onChange={onMaxtokensChange}
                                aria-valuetext={t("components.chattsettingsdrawer.max_lenght") + ` ist ${max_tokensID}`}
                                value={max_output_tokens}
                                aria-labelledby={max_tokens_headerID}
                                id={max_tokensID}
                                disabled={!isEditable || !isOwner}
                            />
                            <br></br>
                            <Label htmlFor={max_tokensID} aria-hidden>
                                {max_output_tokens} Tokens
                            </Label>
                        </div>
                    </div>
                    <div className={styles.header} role="heading" aria-level={3} id={temperature_headerID}>
                        <InfoLabel
                            info={
                                <div>
                                    {t("components.chattsettingsdrawer.temperature_article")} <i>{t("components.chattsettingsdrawer.temperature")}</i>{" "}
                                    {t("components.chattsettingsdrawer.temperature_info")}
                                </div>
                            }
                        >
                            {t("components.chattsettingsdrawer.temperature")}
                        </InfoLabel>
                    </div>
                    <div className={styles.bodyContainer}>
                        <div className={styles.verticalContainer}>
                            <Label htmlFor={temperatureID} aria-hidden size="medium" className={styles.temperatureLabel}>
                                {" "}
                                {t("components.chattsettingsdrawer.min_temperature")}
                            </Label>
                            <Slider
                                min={min_temp}
                                max={max_temp}
                                onChange={onTemperatureChange}
                                aria-valuetext={t("components.chattsettingsdrawer.temperature") + ` ist ${temperature}`}
                                value={temperature}
                                step={0.05}
                                aria-labelledby={temperature_headerID}
                                id={temperatureID}
                                disabled={!isEditable || !isOwner}
                            />
                            <Label htmlFor={temperatureID} className={styles.temperatureLabel} aria-hidden size="medium">
                                {" "}
                                {t("components.chattsettingsdrawer.max_temperatur")}
                            </Label>
                            <Label htmlFor={temperatureID} aria-hidden>
                                {temperature}
                            </Label>
                        </div>
                    </div>
                </>
            )}
        </>
    );
    return <Sidebar actions={actions_component} content={content}></Sidebar>;
};
