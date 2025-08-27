import { DialogContent, Field, InfoLabel } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback, useContext } from "react";
import { LLMContext } from "../../LLMSelector/LLMContextProvider";
import styles from "../EditAssistantDialog.module.css";

interface AdvancedSettingsStepProps {
    temperature: number;
    maxOutputTokens: number;
    isOwner: boolean;
    onTemperatureChange: (temperature: number) => void;
    onMaxTokensChange: (maxTokens: number) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const AdvancedSettingsStep = ({
    temperature,
    maxOutputTokens,
    isOwner,
    onTemperatureChange,
    onMaxTokensChange,
    onHasChanged
}: AdvancedSettingsStepProps) => {
    const { t } = useTranslation();
    const { LLM } = useContext(LLMContext);

    const min_max_tokens = 10;
    const max_max_tokens = LLM.max_output_tokens;
    const min_temp = 0;
    const max_temp = 1;

    // Temperature change
    const onTemperatureChangeHandler = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            onTemperatureChange(Number(ev.target.value));
            onHasChanged(true);
        },
        [onTemperatureChange, onHasChanged]
    );

    // Token change
    const onMaxtokensChangeHandler = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>) => {
            const value = Number(ev.target.value);
            const maxTokens = value > LLM.max_output_tokens && LLM.max_output_tokens !== 0 ? LLM.max_output_tokens : value;
            onMaxTokensChange(maxTokens);
            onHasChanged(true);
        },
        [LLM.max_output_tokens, onMaxTokensChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.rangeField}>
                <label className={styles.formLabel}>
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
                    className={styles.rangeInput}
                />
                <div className={styles.rangeValue}>{temperature}</div>
            </Field>
            <Field size="large" className={styles.rangeField}>
                <label className={styles.formLabel}>
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
                    className={styles.rangeInput}
                />
                <div className={styles.rangeValue}>{maxOutputTokens}</div>
            </Field>
        </DialogContent>
    );
};
