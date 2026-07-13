import { Checkbox, CheckboxOnChangeData, Field, Text } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { ChangeEvent } from "react";

import styles from "./ReviewSection.module.css";

interface ReviewSectionProps {
    confirmed: boolean;
    // Changes whenever the confirmation is reset, forcing the checkbox to remount so it reliably reflects the cleared state.
    confirmationResetKey: number;
    isOwner: boolean;
    onConfirmedChange: (confirmed: boolean) => void;
}

export const ReviewSection = ({ confirmed, confirmationResetKey, isOwner, onConfirmedChange }: ReviewSectionProps) => {
    const { t } = useTranslation();

    const onChange = (_event: ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
        onConfirmedChange(data.checked === true);
    };

    return (
        <Field size="large" className={styles.reviewWrapper}>
            <Checkbox
                key={confirmationResetKey}
                checked={confirmed}
                onChange={onChange}
                disabled={!isOwner}
                required
                className={styles.confirmationCheckbox}
                label={t("components.assistant_editor.review_confirmation_label")}
            />
            {!confirmed && (
                <Text size={200} className={styles.requiredHint}>
                    {t("components.assistant_editor.review_required_hint")}
                </Text>
            )}
        </Field>
    );
};

export default ReviewSection;
