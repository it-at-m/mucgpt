import { Delete24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import {
    Button,
    Slider,
    Label,
    useId,
    SliderProps,
    Field,
    InfoLabel,
    Tooltip,
    Dropdown,
    Option,
    OptionOnSelectData,
    SelectionEvents,
} from "@fluentui/react-components";

import styles from "./BotsettingsDrawer.module.css";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { Sidebar } from "../Sidebar/Sidebar";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { DeletBotDialog } from "../DeleteBotDialog/DeleteBotDialog";
import { getCommunityBot, Bot } from "../../api";
import { CommunityBotStorageService } from "../../service/communitybotstorage";
import { COMMUNITY_BOT_STORE } from "../../constants";
import { use } from "i18next";
interface Props {
    bot: Bot;
    actions: JSX.Element;
    before_content: JSX.Element;
    isOwner: boolean;
    toOwnBots: () => void;
    allVersions: string[];
    deleteBot: () => void;
}

export const CommunityBotSettingsDrawer = ({
    bot,
    actions,
    before_content,
    isOwner,
    toOwnBots,
    allVersions,
    deleteBot
}: Props) => {
    const { t, i18n } = useTranslation();
    const { LLM } = useContext(LLMContext);
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const [isLatestVersion, setIsLatestVersion] = useState<boolean>(true);
    const [temperature, setTemperature] = useState<number>(bot.temperature);
    const [max_output_tokens, setMaxOutputTokens] = useState<number>(bot.max_output_tokens);
    const [systemPrompt, setSystemPrompt] = useState<string>(bot.system_message);
    const [title, setTitle] = useState<string>(bot.title);
    const [description, setDescription] = useState<string>(bot.description);
    const [version, setVersion] = useState<string>(bot.version.toString().replace("-", "."));
    const [id, setID] = useState<string>(bot.id);
    const communityBotStorageService: CommunityBotStorageService = new CommunityBotStorageService(COMMUNITY_BOT_STORE);

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

    const onDelteClick = () => {
        setShowDeleteDialog(true);
    };

    useEffect(() => {
        setTemperature(bot.temperature);
        setMaxOutputTokens(bot.max_output_tokens);
        setSystemPrompt(bot.system_message);
        setTitle(bot.title);
        setDescription(bot.description);
        setID(bot.id);
        setVersion(bot.version.toString().replace("-", "."));
    }, [bot]);

    useEffect(() => {
        for (let i = 0; i < allVersions.length; i++) {
            if (parseFloat(allVersions[i]) > parseFloat(version)) {
                setIsLatestVersion(false);
                return;
            }
        }
        setIsLatestVersion(true);

    }, [allVersions, version]);

    const onVersionSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let v = selection.optionValue;
        if (v == undefined || version == v) {
            return
        }
        setVersion(v);
        getCommunityBot(id, v).then((bot: Bot) => {
            communityBotStorageService.updateBotConfig(bot);
            window.location.href = "/#/community-bot/" + bot.id + "/" + v.replace(".", "-");
            window.location.reload();
        });
    };

    const content = (
        <>
            <>{before_content}</>{" "}
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
            <InfoLabel
                info={
                    <div>
                        {isLatestVersion ? t("botsettingsdrawer.latest_version_selected") : t("botsettingsdrawer.new_version_available")}
                    </div>
                }
                style={isLatestVersion ? {} : { color: "red", fontWeight: "bold" }}
            >{t("botsettingsdrawer.version")}</InfoLabel> {" "}
            <Dropdown
                id="version"
                aria-label={"version"}
                defaultValue={version}
                value={version}
                selectedOptions={[version]}
                appearance="underline"
                size="small"
                positioning="below-start"
                onOptionSelect={onVersionSelected}
                className={styles.dropdown}
            >
                {allVersions.map(
                    (v: string, _) => <Option value={v} text={"v" + v} className={styles.option}>v{v}</Option>
                )}
            </Dropdown>
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