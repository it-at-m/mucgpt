import { DialogContent, Divider, Field, Text } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useContext } from "react";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import sharedStyles from "../AssistantDialog.module.css";
import styles from "./AdvancedSettingsSection.module.css";
import { CreativityRadioGroup } from "../../../CreativityRadioGroup/CreativityRadioGroup";
import { LLMSelector } from "../../../LLMSelector/LLMSelector";

interface AdvancedSettingsSectionProps {
    creativity: string;
    defaultModel?: string;
    isOwner: boolean;
    onCreativityChange: (creativity: string) => void;
    onDefaultModelChange?: (model: string | undefined) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const AdvancedSettingsSection = ({
    creativity,
    defaultModel,
    isOwner,
    onCreativityChange,
    onDefaultModelChange,
    onHasChanged
}: AdvancedSettingsSectionProps) => {
    const { t } = useTranslation();
    const { availableLLMs } = useContext(LLMContext);

    const onCreativitySelect = useCallback(
        (nextCreativity: string) => {
            if (nextCreativity === creativity) return;
            onCreativityChange(nextCreativity);
            onHasChanged?.(true);
        },
        [creativity, onCreativityChange, onHasChanged]
    );

    const onDefaultModelSelect = useCallback(
        (model: string | undefined) => {
            onDefaultModelChange?.(model);
            onHasChanged?.(true);
        },
        [onDefaultModelChange, onHasChanged]
    );

    return (
        <DialogContent className={styles.advancedContent}>
            <Field size="large" className={`${sharedStyles.fieldSection} ${styles.compactField}`}>
                <label className={sharedStyles.formLabel}>{t("components.assistant_editor.creativity")}</label>
                <Text as="p" size={200} className={styles.fieldDescription}>
                    {t("components.assistant_editor.creativity_description")}
                </Text>
                <CreativityRadioGroup
                    value={creativity}
                    onChange={onCreativitySelect}
                    disabled={!isOwner}
                    ariaLabel={t("components.assistant_editor.creativity")}
                />
            </Field>
            <Divider />
            <Field size="large" className={`${sharedStyles.fieldSection} ${styles.compactField}`}>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldRowText}>
                        <label className={sharedStyles.formLabel}>{t("components.assistant_editor.default_model")}</label>
                        <Text as="p" size={200} className={`${styles.fieldDescription} ${styles.defaultModelDescription}`}>
                            {t("components.assistant_editor.default_model_description")}
                        </Text>
                    </div>
                    <LLMSelector
                        appearance="outline"
                        options={availableLLMs}
                        selectedLLM={defaultModel}
                        onSelectionChange={onDefaultModelSelect}
                        noneOption={{
                            label: t("components.assistant_editor.no_default_model"),
                            description: t("components.assistant_editor.no_default_model_description"),
                            onSelect: () => onDefaultModelSelect(undefined)
                        }}
                        disabled={!isOwner}
                    />
                </div>
            </Field>
        </DialogContent>
    );
};
