import { Field, Divider, Text } from "@fluentui/react-components";
import { ExpandableTextarea } from "../AssistantDialogs/shared";

import styles from "./ChatsettingsDrawer.module.css";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CreativityRadioGroup } from "../CreativityRadioGroup/CreativityRadioGroup";

interface Props {
    creativity: string;
    setCreativity: (creativity: string) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
}

export const ChatSettingsContent = ({ creativity, setCreativity, systemPrompt, setSystemPrompt }: Props) => {
    const { t } = useTranslation();

    // System prompt change
    const onSytemPromptChange = useCallback(
        (newValue: string) => {
            setSystemPrompt(newValue || "");
        },
        [setSystemPrompt]
    );

    return (
        <div className={styles.actionSectionContent}>
            {/* System Prompt Section */}
            <Field size="large" className={styles.fieldSection}>
                <label className={styles.formLabel}>{t("components.assistant_editor.system_prompt")}</label>
                <Text as="p" size={200} className={styles.fieldDescription}>
                    {t("components.assistant_editor.system_prompt_description")}
                </Text>
                <ExpandableTextarea
                    className={styles.systempromptTextArea}
                    placeholder={t("components.assistant_editor.prompt_placeholder")}
                    value={systemPrompt}
                    rows={4}
                    onChange={onSytemPromptChange}
                    dialogTitle={t("components.assistant_editor.system_prompt")}
                />
            </Field>

            <Divider className={styles.sectionDivider} />

            {/* Creativity Section */}
            <Field size="large" className={styles.fieldSection}>
                <label className={styles.formLabel}>{t("components.assistant_editor.creativity")}</label>
                <Text as="p" size={200} className={styles.fieldDescription}>
                    {t("components.assistant_editor.creativity_description")}
                </Text>
                <CreativityRadioGroup
                    value={creativity}
                    onChange={setCreativity}
                    ariaLabel={t("components.assistant_editor.creativity")}
                    className={styles.compactRadioGroup}
                />
            </Field>
        </div>
    );
};
