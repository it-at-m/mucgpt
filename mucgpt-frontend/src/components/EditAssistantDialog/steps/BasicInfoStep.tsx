import { DialogContent, Field, Textarea, TextareaOnChangeData, InfoLabel } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditAssistantDialog.module.css";

interface BasicInfoStepProps {
    title: string;
    description: string;
    systemPrompt: string;
    isOwner: boolean;
    onTitleChange: (title: string) => void;
    onDescriptionChange: (description: string) => void;
    onSystemPromptChange: (systemPrompt: string) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const BasicInfoStep = ({
    title,
    description,
    systemPrompt,
    isOwner,
    onTitleChange,
    onDescriptionChange,
    onSystemPromptChange,
    onHasChanged
}: BasicInfoStepProps) => {
    const { t } = useTranslation();

    const onTitleChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onTitleChange(newValue?.value ?? "");
            onHasChanged(true);
        },
        [onTitleChange, onHasChanged]
    );

    const onDescriptionChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onDescriptionChange(newValue?.value ?? "");
            onHasChanged(true);
        },
        [onDescriptionChange, onHasChanged]
    );

    const onPromptChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onSystemPromptChange(newValue?.value ?? "");
            onHasChanged(true);
        },
        [onSystemPromptChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_assistant_dialog.assistant_title")}:</label>
                <Textarea
                    placeholder={t("components.edit_assistant_dialog.assistant_title")}
                    value={title}
                    size="large"
                    onChange={onTitleChanged}
                    maxLength={100}
                    disabled={!isOwner}
                    className={styles.flexibleTextarea}
                />
            </Field>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_assistant_dialog.assistant_description")}:</label>
                <Textarea
                    placeholder={t("components.edit_assistant_dialog.assistant_description")}
                    value={description}
                    size="large"
                    onChange={onDescriptionChanged}
                    disabled={!isOwner}
                    className={styles.flexibleTextarea}
                />
            </Field>
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
