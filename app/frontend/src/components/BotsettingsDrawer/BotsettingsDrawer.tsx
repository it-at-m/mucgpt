import { Delete24Regular, Dismiss24Regular, Edit24Regular, Save24Regular } from "@fluentui/react-icons";
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
    Dropdown,
    Option,
    SelectionEvents,
    OptionOnSelectData
} from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { ReactNode, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Sidebar } from "../Sidebar/Sidebar";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
interface Props {
    temperature: number;
    setTemperature: (temp: number) => void;
    max_output_tokens: number;
    setMaxTokens: (maxTokens: number) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
    title: string;
    setTitle: (title: string) => void;
    bot_id: string;
    description: string;
    setDescription: (description: string) => void;
    setPublish: (publish: boolean) => void;
    actions: ReactNode;
    before_content: ReactNode;
}

export const BotsettingsDrawer = ({
    temperature,
    setTemperature,
    max_output_tokens,
    setMaxTokens,
    systemPrompt,
    setSystemPrompt,
    title,
    setTitle,
    bot_id,
    description,
    setDescription,
    setPublish,
    actions,
    before_content
}: Props) => {
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

    const onTemperatureChange: SliderProps["onChange"] = (_, data) => setTemperature(data.value);
    const onMaxtokensChange: SliderProps["onChange"] = (_, data) => setMaxTokens(data.value);

    const storageService: BotStorageService = new BotStorageService(BOT_STORE);

    const onDelete = async () => {
        await storageService.deleteConfigAndChatsForBot(bot_id);
        window.location.href = "/";
    };
    const onSytemPromptChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setSystemPrompt(newValue.value);
        else setSystemPrompt("");
    };
    const onTitleChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setTitle(newValue.value);
        else setTitle("Assistent " + bot_id);
    };
    const onDescriptionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setDescription(newValue.value);
        else setDescription("");
    };

    const toggleReadOnly = () => {
        setEditable(!isEditable);
    };

    const onClearSystemPrompt = () => {
        setSystemPrompt("");
    };
    const onPublishSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        setPublish(selection.optionValue == "Ja" ? true : false);
    };

    const actions_component = (
        <>
            {actions}
            <Button
                appearance="secondary"
                icon={isEditable ? <Save24Regular className={styles.iconRightMargin} /> : <Edit24Regular className={styles.iconRightMargin} />}
                onClick={toggleReadOnly}
            >
                {isEditable ? t("components.botsettingsdrawer.finish_edit") : t("components.botsettingsdrawer.edit")}
            </Button>
            <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                <Button appearance="secondary" onClick={onDelete} icon={<Delete24Regular className={styles.iconRightMargin} />}>
                    {t("components.botsettingsdrawer.delete")}
                </Button>
            </Tooltip>
        </>
    );
    const content = (
        <>
            <>{before_content}</>
            {" "}
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
                                />
                            }
                        </Field>
                    </div>
                </div>
            )}
            {isEditable ? (
                <div className={styles.header} role="heading" aria-level={3}>
                    <div className={styles.systemPromptHeadingContainer}>{t("create_bot.description")}</div>
                </div>
            ) :
                (
                    <div className={styles.header} role="heading" aria-level={3}>
                        <h3>{t("create_bot.description")}</h3>
                    </div>
                )
            }
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
                            ></Button>
                        </Tooltip>
                    )}
                </div>
            </div>
            <div className={styles.bodyContainer}>
                <div>
                    {isEditable && (
                        <Field size="large">
                            <Textarea
                                textarea={styles.systempromptTextArea}
                                placeholder={t("components.chattsettingsdrawer.system_prompt")}
                                resize="vertical"
                                value={systemPrompt}
                                size="large"
                                rows={15}
                                onChange={onSytemPromptChange}
                            />
                        </Field>
                    )}
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
                <InfoLabel info={<div>{t("components.chattsettingsdrawer.max_lenght_info")}</div>}>{t("components.chattsettingsdrawer.max_lenght")}</InfoLabel>
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
                        disabled={!isEditable}
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
                        disabled={!isEditable}
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
            <br />
            Veröffentlichen:
            <br />
            <Dropdown
                id="publish"
                aria-label="Veröffentlichen"
                defaultValue="Nein"
                appearance="underline"
                size="small"
                positioning="below-start"
                onOptionSelect={onPublishSelected}
                disabled
            >
                <Option text="Ja" className={styles.option} key={1}>
                    Ja
                </Option>
                <Option text="Nein" className={styles.option} key={2}>
                    Nein
                </Option>
            </Dropdown>
        </>
    );
    return <Sidebar actions={actions_component} content={content}></Sidebar>;
};
