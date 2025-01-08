import { Dismiss24Regular } from "@fluentui/react-icons";
import {
    OverlayDrawer,
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
    SelectionEvents,
    OptionOnSelectData
} from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { deleteCommunityBotWithId, storeBot } from "../../service/storage_bot";
import { ChatSettingsButton } from "../ChatSettingsButton/ChatSettingsButton";
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
    isOwner: boolean;
    toOwnBots: () => void;
}

export const CommunityBotSettingsDrawer = ({
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
    isOwner,
    toOwnBots
}: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t, i18n } = useTranslation();
    const { LLM } = useContext(LLMContext);
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, []);

    const temperature_headerID = useId("header-temperature");
    const temperatureID = useId("input-temperature");
    const max_tokens_headerID = useId("header-max_tokens");
    const max_tokensID = useId("input-max_tokens");

    const min_max_tokens = 10;
    const max_max_tokens = LLM.max_output_tokens;
    const min_temp = 0;
    const max_temp = 1;

    const isEmptySystemPrompt = systemPrompt.trim() === "";

    const onTemperatureChange: SliderProps["onChange"] = (_, data) => setTemperature(data.value);
    const onMaxtokensChange: SliderProps["onChange"] = (_, data) => setMaxTokens(data.value);

    const onDelteClick = () => {
        window.location.href = "/";
        deleteCommunityBotWithId(+bot_id);
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

    const onClearSystemPrompt = () => {
        setSystemPrompt("");
    };
    return (
        <div>
            <OverlayDrawer size="medium" position="end" open={isOpen} style={{ padding: "30px", alignItems: "stretch" }}>
                <div className={styles.title} role="heading" aria-level={2}>
                    {t("components.chattsettingsdrawer.settings_button")}
                    <Tooltip content={t("components.chattsettingsdrawer.settings_button_close")} relationship="description" positioning="below">
                        <Button
                            appearance="subtle"
                            aria-label={t("components.chattsettingsdrawer.settings_button_close")}
                            icon={<Dismiss24Regular />}
                            onClick={() => setIsOpen(false)}
                        />
                    </Tooltip>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    <div className={styles.systemPromptHeadingContainer}>{t("create_bot.title")}</div>
                </div>
                <div className={styles.bodyContainer}>
                    <div>
                        <Field size="large">
                            <Textarea
                                textarea={styles.systempromptTextArea}
                                placeholder={t("create_bot.title")}
                                value={title}
                                size="large"
                                rows={1}
                                maxLength={100}
                                onChange={onTitleChange}
                                disabled={!isOwner}
                            />
                        </Field>
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    <div className={styles.systemPromptHeadingContainer}>{t("create_bot.description")}</div>
                </div>
                <div className={styles.bodyContainer}>
                    <div>
                        <Field size="large">
                            <Textarea
                                textarea={styles.systempromptTextArea}
                                placeholder={t("create_bot.description")}
                                value={description}
                                size="large"
                                rows={3}
                                onChange={onDescriptionChange}
                                disabled={!isOwner}
                            />
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
                                rows={7}
                                onChange={onSytemPromptChange}
                                disabled={!isOwner}
                            />
                        </Field>
                    </div>
                </div>
                <div className={styles.deleteButton}>
                    <Tooltip content={"Assistent entfernen"} relationship="description" positioning="below">
                        <Button onClick={onDelteClick}>{"Assistent entfernen"}</Button>
                    </Tooltip>
                </div>
                <div className={styles.deleteButton}>
                    <Tooltip content={"Assistent bearbeiten und untereigenen Assisstenten speichern"} relationship="description" positioning="below">
                        <Button onClick={toOwnBots}>{"Assistent bearbeiten"}</Button>
                    </Tooltip>
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
                            defaultValue={20}
                            onChange={onMaxtokensChange}
                            aria-valuetext={t("components.chattsettingsdrawer.max_lenght") + ` ist ${max_tokensID}`}
                            value={max_output_tokens}
                            aria-labelledby={max_tokens_headerID}
                            id={max_tokensID}
                            disabled={!isOwner}
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
                            defaultValue={2}
                            onChange={onTemperatureChange}
                            aria-valuetext={t("components.chattsettingsdrawer.temperature") + ` ist ${temperature}`}
                            value={temperature}
                            step={0.05}
                            aria-labelledby={temperature_headerID}
                            id={temperatureID}
                            disabled={!isOwner}
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
            </OverlayDrawer>

            <ChatSettingsButton isEmptySystemPrompt={isEmptySystemPrompt} onClick={onClickRightButton} />
        </div>
    );
};
