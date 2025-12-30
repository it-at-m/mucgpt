import { DialogContent, Field, Textarea, TextareaOnChangeData } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { InfoLabel } from "@fluentui/react-components";
import styles from "../AssistantDialog.module.css";

interface CombinedDetailsStepProps {
    title: string;
    description: string;
    systemPrompt: string;
    isOwner: boolean;
    onTitleChange: (title: string) => void;
    onDescriptionChange: (description: string) => void;
    onSystemPromptChange: (systemPrompt: string) => void;
    onHasChanged?: (hasChanged: boolean) => void;
}

export const CombinedDetailsStep = ({
    title,
    description,
    systemPrompt,
    isOwner,
    onTitleChange,
    onDescriptionChange,
    onSystemPromptChange,
    onHasChanged
}: CombinedDetailsStepProps) => {
    const { t } = useTranslation();

    const onTitleChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onTitleChange(newValue?.value || "");
            onHasChanged?.(true);
        },
        [onTitleChange, onHasChanged]
    );

    const onDescriptionChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onDescriptionChange(newValue?.value || "");
            onHasChanged?.(true);
        },
        [onDescriptionChange, onHasChanged]
    );

    const onPromptChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            onSystemPromptChange(newValue?.value || "");
            onHasChanged?.(true);
        },
        [onSystemPromptChange, onHasChanged]
    );

    return (
        <DialogContent>
            <p className={styles.hintText}>{t("components.create_assistant_dialog.hint_text_step2")}</p>

            <Field size="large" className={styles.fieldSection}>
                <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.title")}:*</label>
                <Textarea
                    placeholder={t("components.create_assistant_dialog.title_placeholder")}
                    value={title}
                    size="large"
                    rows={1}
                    resize="vertical"
                    onChange={onTitleChanged}
                    maxLength={100}
                    disabled={!isOwner}
                />
            </Field>

            <Field size="large" className={styles.fieldSection}>
                <label className={styles.fieldLabel}>{t("components.create_assistant_dialog.description")}:</label>
                <Textarea
                    placeholder={t("components.create_assistant_dialog.description_placeholder")}
                    value={description}
                    size="large"
                    rows={3}
                    resize="vertical"
                    onChange={onDescriptionChanged}
                    disabled={!isOwner}
                />
            </Field>

            <Field size="large" className={styles.fieldSection}>
                <label className={styles.fieldLabel}>
                    {t("components.create_assistant_dialog.prompt")}:*
                    <InfoLabel
                        info={
                            <div>
                                <i>{t("components.chattsettingsdrawer.system_prompt")}s </i>
                                {t("components.chattsettingsdrawer.system_prompt_info")}
                            </div>
                        }
                    />
                </label>
                <Textarea
                    placeholder={t("components.create_assistant_dialog.prompt_placeholder")}
                    rows={7}
                    resize="vertical"
                    value={systemPrompt}
                    size="large"
                    onChange={onPromptChanged}
                    disabled={!isOwner}
                />
            </Field>
        </DialogContent>
    );
};
