import { Dismiss24Regular } from "@fluentui/react-icons";
import { Button, useId, Field, InfoLabel, Tooltip, Textarea, TextareaOnChangeData, Dropdown, Option } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

interface Props {
    temperature: number;
    setTemperature: (temp: number) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
    reasoningEffort?: "low" | "medium" | "high";
    setReasoningEffort: (effort: "low" | "medium" | "high" | undefined) => void;
    supportsReasoning: boolean;
}

export const ChatSettingsContent = ({ temperature, setTemperature, systemPrompt, setSystemPrompt, reasoningEffort, setReasoningEffort, supportsReasoning }: Props) => {
    const { t } = useTranslation();

    const temperature_headerID = useId("header-temperature");
    const temperatureID = useId("input-temperature");
    const systemPromptID = useId("header-system-prompt");
    const reasoningEffortID = useId("input-reasoning-effort");

    const min_temp = 0;
    const max_temp = 1;

    // Temperature change - simplified to match AdvancedSettingsStep
    const onTemperatureChangeHandler = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            setTemperature(Number(ev.target.value));
        },
        [setTemperature]
    );

    // System prompt change
    const onSytemPromptChange = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (newValue?.value) setSystemPrompt(newValue.value);
            else setSystemPrompt("");
        },
        [setSystemPrompt]
    );

    // Clear system prompt
    const onClearSystemPrompt = () => {
        setSystemPrompt("");
    };

    // Reasoning effort change
    const onReasoningEffortChange = useCallback(
        (_ev: any, data: any) => {
            const value = data.optionValue as "low" | "medium" | "high" | "none";
            setReasoningEffort(value === "none" ? undefined : value);
        },
        [setReasoningEffort]
    );

    // Helper to capitalize first letter
    const capitalizeFirst = (str: string) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    return (
        <div className={styles.actionSectionContent}>
            {/* System Prompt Section */}
            <div className={styles.sectionContainer}>
                <div className={styles.header} role="heading" aria-level={3} id={systemPromptID}>
                    <div className={styles.headerContent}>
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
                    <div className={styles.systemPromptHeadingContainer}>
                        <Tooltip content={t("components.chattsettingsdrawer.system_prompt_clear")} relationship="description" positioning="below">
                            <Button
                                aria-label={t("components.chattsettingsdrawer.system_prompt_clear")}
                                icon={<Dismiss24Regular />}
                                appearance="subtle"
                                onClick={onClearSystemPrompt}
                                size="small"
                            />
                        </Tooltip>
                    </div>
                </div>

                <div>
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
            </div>

            {/* Temperature Section */}
            <div className={styles.sectionContainer}>
                <div className={styles.header} role="heading" aria-level={3} id={temperature_headerID}>
                    <div className={styles.headerContent}>
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
                </div>

                <div>
                    <Field size="large" className={styles.rangeField}>
                        <input
                            type="range"
                            min={min_temp}
                            max={max_temp}
                            step={0.05}
                            value={temperature}
                            onChange={onTemperatureChangeHandler}
                            className={styles.rangeInput}
                            id={temperatureID}
                            aria-labelledby={temperature_headerID}
                        />
                        <div className={styles.rangeValue}>{temperature.toFixed(2)}</div>
                    </Field>
                </div>
            </div>

            {/* Reasoning Effort Section - Only show for reasoning models */}
            {supportsReasoning && (
                <div className={styles.sectionContainer}>
                    <div className={styles.header} role="heading" aria-level={3}>
                        <div className={styles.headerContent}>
                            <InfoLabel
                                info={
                                    <div>
                                        <i>Reasoning Effort</i> controls how much time the model spends thinking before responding. Higher effort may improve quality for complex tasks.
                                    </div>
                                }
                            >
                                Reasoning Effort
                            </InfoLabel>
                        </div>
                    </div>

                    <div>
                        <Field size="large">
                            <Dropdown
                                id={reasoningEffortID}
                                value={reasoningEffort === undefined ? "Default" : capitalizeFirst(reasoningEffort)}
                                selectedOptions={[reasoningEffort || "none"]}
                                onOptionSelect={onReasoningEffortChange}
                            >
                                <Option value="none">Default</Option>
                                <Option value="low">Low</Option>
                                <Option value="medium">Medium</Option>
                                <Option value="high">High</Option>
                            </Dropdown>
                        </Field>
                    </div>
                </div>
            )}
        </div>
    );
};
