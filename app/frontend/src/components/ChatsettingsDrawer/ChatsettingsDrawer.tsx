import { Dismiss24Regular } from "@fluentui/react-icons";
import { Button, Slider, Label, useId, SliderProps, Field, InfoLabel, Tooltip, Textarea, TextareaOnChangeData } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { Sidebar } from "../Sidebar/Sidebar";
interface Props {
    temperature: number;
    setTemperature: (temp: number) => void;
    max_output_tokens: number;
    setMaxTokens: (maxTokens: number) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
    actions: ReactNode;
    content: ReactNode;
}

export const ChatsettingsDrawer = ({
    temperature,
    setTemperature,
    max_output_tokens,
    setMaxTokens,
    systemPrompt,
    setSystemPrompt,
    actions,
    content
}: Props) => {
    const { t, i18n } = useTranslation();
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

    const onSytemPromptChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) setSystemPrompt(newValue.value);
        else setSystemPrompt("");
    };

    const onClearSystemPrompt = () => {
        setSystemPrompt("");
    };
    const sidebar_action = <>{actions}</>;
    const sidebar_content = (
        <>
            <>{content}</>
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
                        />
                    </Field>
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

            <div className={styles.header} role="heading" aria-level={3} id={max_tokens_headerID}>
                <InfoLabel info={<div>{t("components.chattsettingsdrawer.max_lenght_info")}</div>}>{t("components.chattsettingsdrawer.max_lenght")}</InfoLabel>
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
                    />
                    <br></br>
                    <Label htmlFor={max_tokensID} aria-hidden>
                        {max_output_tokens} Tokens
                    </Label>
                </div>
            </div>
        </>
    );
    return (
        <div>
            <Sidebar actions={sidebar_action} content={sidebar_content}></Sidebar>
        </div>
    );
};
