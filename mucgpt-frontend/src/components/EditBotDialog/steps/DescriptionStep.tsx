import { DialogContent, Field, Textarea, TextareaOnChangeData } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "../EditBotDialog.module.css";

interface DescriptionStepProps {
    description: string;
    isOwner: boolean;
    onDescriptionChange: (description: string) => void;
    onHasChanged: (hasChanged: boolean) => void;
}

export const DescriptionStep = ({ description, isOwner, onDescriptionChange, onHasChanged }: DescriptionStepProps) => {
    const { t } = useTranslation();

    const onDescriptionChanged = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (newValue?.value) {
                onDescriptionChange(newValue.value);
                onHasChanged(true);
            } else {
                onDescriptionChange("");
            }
        },
        [onDescriptionChange, onHasChanged]
    );

    return (
        <DialogContent>
            <Field size="large" className={styles.formField}>
                <label className={styles.formLabel}>{t("components.edit_bot_dialog.bot_description")}:</label>
                <Textarea
                    placeholder={t("components.edit_bot_dialog.bot_description")}
                    value={description}
                    resize="vertical"
                    size="large"
                    onChange={onDescriptionChanged}
                    disabled={!isOwner}
                />
            </Field>
        </DialogContent>
    );
};
