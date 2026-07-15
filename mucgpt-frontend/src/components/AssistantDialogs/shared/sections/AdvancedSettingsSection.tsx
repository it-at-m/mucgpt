import { DialogContent, Divider, Field, Dropdown, Option, Text, type OptionOnSelectData, type SelectionEvents } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useContext } from "react";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import sharedStyles from "../AssistantDialog.module.css";
import styles from "./AdvancedSettingsSection.module.css";
import { CreativityRadioGroup } from "../../../CreativityRadioGroup/CreativityRadioGroup";

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

    // Model change
    const onDefaultModelChangeHandler = useCallback(
        (_ev: SelectionEvents, data: OptionOnSelectData) => {
            const value = data.optionValue === "none" ? undefined : data.optionValue;
            onDefaultModelChange?.(value);
            onHasChanged?.(true);
        },
        [onDefaultModelChange, onHasChanged]
    );

    const noDefaultModelOptionValue = "none";
    const noDefaultModelLabel = t("components.assistant_editor.no_default_model");
    const defaultModelValue = defaultModel ? availableLLMs.find(model => model.llm_name === defaultModel)?.llm_name || defaultModel : noDefaultModelLabel;
    const selectedDefaultModelOptions = defaultModel ? [defaultModelValue] : [noDefaultModelOptionValue];

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
                <label className={sharedStyles.formLabel}>{t("components.assistant_editor.default_model")}</label>
                <Text as="p" size={200} className={`${styles.fieldDescription} ${styles.defaultModelDescription}`}>
                    {t("components.assistant_editor.default_model_description")}
                </Text>
                <Dropdown
                    placeholder={t("components.assistant_editor.default_model_placeholder")}
                    value={defaultModelValue}
                    selectedOptions={selectedDefaultModelOptions}
                    onOptionSelect={onDefaultModelChangeHandler}
                    disabled={!isOwner}
                >
                    <Option key={noDefaultModelOptionValue} value={noDefaultModelOptionValue}>
                        {noDefaultModelLabel}
                    </Option>
                    {availableLLMs.map(model => (
                        <Option key={model.llm_name} value={model.llm_name}>
                            {model.llm_name}
                        </Option>
                    ))}
                </Dropdown>
            </Field>
        </DialogContent>
    );
};
