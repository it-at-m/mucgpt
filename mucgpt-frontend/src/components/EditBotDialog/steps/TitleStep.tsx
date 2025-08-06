import { DialogContent, Field, Textarea, TextareaOnChangeData } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditBotDialog.module.css";

interface TitleStepProps {
    title: string;
    isOwner: boolean;
    onTitleChange: (title: string) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const TitleStep = ({ title, isOwner, onTitleChange, onHasChanged }: TitleStepProps) => {
    const { t } = useTranslation();

    const onTitleChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (newValue?.value) {
                onTitleChange(newValue.value);
                onHasChanged(true);
            } else {
                onTitleChange("Assistent");
            }
        },
        [onTitleChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.bot_title")}:</label>
                <Textarea
                    placeholder={t("components.edit_bot_dialog.bot_title")}
                    value={title}
                    size="large"
                    onChange={onTitleChanged}
                    maxLength={100}
                    disabled={!isOwner}
                />
            </Field>
        </DialogContent>
    );
};
