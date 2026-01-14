import { DialogContent, Field, InfoLabel, Dropdown, Option } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useContext } from "react";
import { LLMContext } from "../../../LLMSelector/LLMContextProvider";
import sharedStyles from "../AssistantDialog.module.css";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "../../../../constants";

interface AdvancedSettingsStepProps {
    temperature: number;
    maxOutputTokens: number;
    defaultModel?: string;
    isOwner: boolean;
    onTemperatureChange: (temperature: number) => void;
    onMaxTokensChange: (maxTokens: number) => void;
    onDefaultModelChange?: (model: string | undefined) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const AdvancedSettingsStep = ({
    temperature,
    maxOutputTokens,
    defaultModel,
    isOwner,
    onTemperatureChange,
    onMaxTokensChange,
    onDefaultModelChange,
    onHasChanged
}: AdvancedSettingsStepProps) => {
    const { t } = useTranslation();
    const { LLM, availableLLMs } = useContext(LLMContext);

    const min_max_tokens = 10;
    const llmMaxOutputTokens = LLM.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const max_max_tokens = Math.max(llmMaxOutputTokens, maxOutputTokens, min_max_tokens);
    const min_temp = 0;
    const max_temp = 1;

    // Temperature change
    const onTemperatureChangeHandler = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            onTemperatureChange(Number(ev.target.value));
            onHasChanged?.(true);
        },
        [onTemperatureChange, onHasChanged]
    );

    // Token change
    const onMaxtokensChangeHandler = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            const value = Number(ev.target.value);
            const limit = llmMaxOutputTokens;
            const maxTokens = limit > 0 && value > limit ? limit : value;
            onMaxTokensChange(maxTokens);
            onHasChanged?.(true);
        },
        [llmMaxOutputTokens, onMaxTokensChange, onHasChanged]
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
            <Field size="large" className={sharedStyles.rangeField}>
                <label className={sharedStyles.formLabel}>
                    <InfoLabel
                        info={
                            <div>
                                {t("components.chattsettingsdrawer.temperature_article")} <i>{t("components.chattsettingsdrawer.temperature")}</i>{" "}
                                {t("components.chattsettingsdrawer.temperature_info")}
                            </div>
                        }
                    >
                        {t("components.edit_assistant_dialog.temperature")}
                    </InfoLabel>
                </label>
                <input
                    type="range"
                    min={min_temp}
                    max={max_temp}
                    step={0.05}
                    value={temperature}
                    onChange={onTemperatureChangeHandler}
                    disabled={!isOwner}
                    className={sharedStyles.rangeInput}
                />
                <div className={sharedStyles.rangeValue}>{temperature}</div>
            </Field>
            <Field size="large" className={sharedStyles.rangeField}>
                <label className={sharedStyles.formLabel}>
                    <InfoLabel info={<div>{t("components.chattsettingsdrawer.max_lenght_info")}</div>}>
                        {t("components.edit_assistant_dialog.max_output_tokens")}
                    </InfoLabel>
                </label>
                <input
                    type="range"
                    min={min_max_tokens}
                    max={max_max_tokens}
                    step={100}
                    value={maxOutputTokens}
                    onChange={onMaxtokensChangeHandler}
                    disabled={!isOwner}
                    className={sharedStyles.rangeInput}
                />
                <div className={sharedStyles.rangeValue}>{maxOutputTokens}</div>
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
