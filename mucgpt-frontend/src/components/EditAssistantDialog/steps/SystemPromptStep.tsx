import { DialogContent, Field, Textarea, TextareaOnChangeData, InfoLabel } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditAssistantDialog.module.css";

interface SystemPromptStepProps {
    systemPrompt: string;
    isOwner: boolean;
    onSystemPromptChange: (systemPrompt: string) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const SystemPromptStep = ({ systemPrompt, isOwner, onSystemPromptChange, onHasChanged }: SystemPromptStepProps) => {
    const { t } = useTranslation();

    const onPromptChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (newValue?.value) {
                onSystemPromptChange(newValue.value);
                onHasChanged(true);
            } else {
                onSystemPromptChange("");
            }
        },
        [onSystemPromptChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>
                    <InfoLabel
                        info={
                            <div>
                                <i>{t("components.chattsettingsdrawer.system_prompt")}s</i>
                                {t("components.chattsettingsdrawer.system_prompt_info")}
                            </div>
                        }
                    >
                        {t("components.edit_assistant_dialog.system_prompt")}:
                    </InfoLabel>
                </label>
                <Textarea
                    placeholder={t("components.edit_assistant_dialog.system_prompt")}
                    value={systemPrompt}
                    size="large"
                    onChange={onPromptChanged}
                    disabled={!isOwner}
                    className={styles.flexibleTextarea}
                />
            </Field>
        </DialogContent>
    );
};
