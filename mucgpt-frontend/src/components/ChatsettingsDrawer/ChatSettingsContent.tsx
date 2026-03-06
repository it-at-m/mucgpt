import { Dismiss24Regular } from "@fluentui/react-icons";
import { Button, useId, Field, InfoLabel, Tooltip, Textarea, TextareaOnChangeData, Dropdown, Option } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../../constants";

interface Props {
    creativity: string;
    setCreativity: (creativity: string) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
    reasoningEffort?: "low" | "medium" | "high";
    setReasoningEffort: (effort: "low" | "medium" | "high" | undefined) => void;
    supportsReasoning: boolean;
}

export const ChatSettingsContent = ({
    creativity,
    setCreativity,
    systemPrompt,
    setSystemPrompt,
    reasoningEffort,
    setReasoningEffort,
    supportsReasoning
}: Props) => {
    const { t } = useTranslation();

    const creativity_headerID = useId("header-creativity");
    const creativityID = useId("input-creativity");
    const systemPromptID = useId("header-system-prompt");
    const reasoningEffortID = useId("input-reasoning-effort");

    // Creativity change
    const onCreativityChangeHandler = useCallback(
        (_ev: any, data: any) => {
            setCreativity(data.optionValue);
        },
        [setCreativity]
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

            {/* Creativity Section */}
            <div className={styles.sectionContainer}>
                <div className={styles.header} role="heading" aria-level={3} id={creativity_headerID}>
                    <div className={styles.headerContent}>
                        <InfoLabel info={<div>{t("components.chattsettingsdrawer.creativity_info")}</div>}>
                            {t("components.chattsettingsdrawer.creativity")}
                        </InfoLabel>
                    </div>
                </div>

                <div>
                    <Field size="large">
                        <Dropdown
                            placeholder={t("components.edit_assistant_dialog.creativity_placeholder")}
                            value={creativity}
                            selectedOptions={[creativity]}
                            onOptionSelect={onCreativityChangeHandler}
                            id={creativityID}
                            aria-labelledby={creativity_headerID}
                        >
                            <Option key={CREATIVITY_LOW} value={CREATIVITY_LOW}>
                                {t("components.edit_assistant_dialog.creativity_low")}
                            </Option>
                            <Option key={CREATIVITY_MEDIUM} value={CREATIVITY_MEDIUM}>
                                {t("components.edit_assistant_dialog.creativity_medium")}
                            </Option>
                            <Option key={CREATIVITY_HIGH} value={CREATIVITY_HIGH}>
                                {t("components.edit_assistant_dialog.creativity_high")}
                            </Option>
                        </Dropdown>
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
                                        <i>Reasoning Effort</i> controls how much time the model spends thinking before responding. Higher effort may improve
                                        quality for complex tasks.
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
