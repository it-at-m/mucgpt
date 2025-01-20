import { Delete24Regular, Dismiss24Regular } from "@fluentui/react-icons";
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
} from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { deleteCommunityBotWithId, storeBot } from "../../service/storage_bot";
import { Sidebar } from "../Sidebar/Sidebar";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { DeletBotDialog } from "../DeleteBotDialog/DeleteBotDialog";
interface Props {
    actions: JSX.Element;
    temperature: number;
    max_output_tokens: number;
    systemPrompt: string;
    title: string;
    bot_id: string;
    description: string;
    isOwner: boolean;
    toOwnBots: () => void;
}

export const CommunityBotSettingsDrawer = ({
    actions,
    temperature,
    max_output_tokens,
    systemPrompt,
    title,
    bot_id,
    description,
    isOwner,
    toOwnBots
}: Props) => {
    const { t, i18n } = useTranslation();
    const { LLM } = useContext(LLMContext);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);

    const temperature_headerID = useId("header-temperature");
    const temperatureID = useId("input-temperature");
    const max_tokens_headerID = useId("header-max_tokens");
    const max_tokensID = useId("input-max_tokens");

    const min_max_tokens = 10;
    const max_max_tokens = LLM.max_output_tokens;
    const min_temp = 0;
    const max_temp = 1;

    const onTemperatureChange: SliderProps["onChange"] = (_, data) => { };
    const onMaxtokensChange: SliderProps["onChange"] = (_, data) => { };

    const deleteBot = () => {
        window.location.href = "/";
        deleteCommunityBotWithId(bot_id);
    };

    const onDelteClick = () => {
        setShowDeleteDialog(true);
    };
    const content = (
        <>
            {" "}
            <div className={styles.bodyContainer}>
                <div>
                    <Field size="large">
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
                </div>
            </div>
            <div className={styles.bodyContainer}>
                <div>
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
                        disabled
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
                        disabled
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
            <DeletBotDialog showDialog={showDeleteDialog} setShowDialog={setShowDeleteDialog} bot_name={title} deleteBot={deleteBot} />
        </>)
    const actions_component = (
        <>
            {actions}
            <Tooltip content={t("components.botsettingsdrawer.delete")} relationship="description" positioning="below">
                <Button appearance="secondary" onClick={onDelteClick} icon={<Delete24Regular className={styles.iconRightMargin} />}>
                    {t("components.botsettingsdrawer.delete")}
                </Button>
            </Tooltip>
        </>
    );
    return <Sidebar content={content} actions={actions_component} />;
};