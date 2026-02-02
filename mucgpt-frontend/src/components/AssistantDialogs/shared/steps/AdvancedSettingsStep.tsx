import { DialogContent, Field, InfoLabel, Dropdown, Option } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useContext } from "react";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import sharedStyles from "../AssistantDialog.module.css";

interface AdvancedSettingsStepProps {
    creativity: string;
    defaultModel?: string;
    isOwner: boolean;
    onCreativityChange: (creativity: string) => void;
    onDefaultModelChange?: (model: string | undefined) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const AdvancedSettingsStep = ({
    creativity,
    defaultModel,
    isOwner,
    onCreativityChange,
    onDefaultModelChange,
    onHasChanged
}: AdvancedSettingsStepProps) => {
    const { t } = useTranslation();
    const { availableLLMs } = useContext(LLMContext);

    // Creativity change
    const onCreativityChangeHandler = useCallback(
        (_ev: any, data: any) => {
            onCreativityChange(data.optionValue);
            onHasChanged?.(true);
        },
        [onCreativityChange, onHasChanged]
    );

    // Model change
    const onDefaultModelChangeHandler = useCallback(
        (_ev: any, data: any) => {
            const value = data.optionValue === "none" ? undefined : data.optionValue;
            onDefaultModelChange?.(value);
            onHasChanged?.(true);
        },
        [onDefaultModelChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={sharedStyles.fieldSection}>
                <label className={sharedStyles.formLabel}>
                    <InfoLabel info={<div>{t("components.chattsettingsdrawer.creativity_info")}</div>}>
                        {t("components.edit_assistant_dialog.creativity")}
                    </InfoLabel>
                </label>
                <Dropdown
                    placeholder={t("components.edit_assistant_dialog.creativity_placeholder")}
                    value={creativity}
                    selectedOptions={[creativity]}
                    onOptionSelect={onCreativityChangeHandler}
                    disabled={!isOwner}
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
            <Field size="large" className={sharedStyles.fieldSection}>
                <label className={sharedStyles.formLabel}>
                    <InfoLabel info={<div>{t("components.edit_assistant_dialog.default_model_info")}</div>}>
                        {t("components.edit_assistant_dialog.default_model")}
                    </InfoLabel>
                </label>
                <Dropdown
                    placeholder={t("components.edit_assistant_dialog.default_model_placeholder")}
                    value={defaultModel ? availableLLMs.find((m: any) => m.llm_name === defaultModel)?.llm_name : ""}
                    selectedOptions={defaultModel ? [defaultModel] : []}
                    onOptionSelect={onDefaultModelChangeHandler}
                    disabled={!isOwner}
                >
                    <Option key="none" value="none">
                        {t("components.edit_assistant_dialog.no_default_model")}
                    </Option>
                    {availableLLMs.map((model: any) => (
                        <Option key={model.llm_name} value={model.llm_name}>
                            {model.llm_name}
                        </Option>
                    ))}
                </Dropdown>
            </Field>
        </DialogContent>
    );
};
