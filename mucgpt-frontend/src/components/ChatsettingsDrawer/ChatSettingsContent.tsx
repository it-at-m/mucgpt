import { Dismiss24Regular } from "@fluentui/react-icons";
import { Button, useId, Field, InfoLabel, Tooltip, Textarea, TextareaOnChangeData, Dropdown, Option } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

interface Props {
    creativity: string;
    setCreativity: (creativity: string) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
}

export const ChatSettingsContent = ({ creativity, setCreativity, systemPrompt, setSystemPrompt }: Props) => {
    const { t } = useTranslation();

    const creativity_headerID = useId("header-creativity");
    const creativityID = useId("input-creativity");
    const systemPromptID = useId("header-system-prompt");

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
                            <Option key="aus" value="aus">
                                {t("components.edit_assistant_dialog.creativity_aus")}
                            </Option>
                            <Option key="normal" value="normal">
                                {t("components.edit_assistant_dialog.creativity_normal")}
                            </Option>
                            <Option key="hoch" value="hoch">
                                {t("components.edit_assistant_dialog.creativity_hoch")}
                            </Option>
                        </Dropdown>
                    </Field>
                </div>
            </div>
        </div>
    );
};
