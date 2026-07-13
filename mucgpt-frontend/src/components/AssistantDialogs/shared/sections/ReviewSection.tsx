import { Button, Checkbox, CheckboxOnChangeData, Field, Link, Text } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { ChangeEvent, useState } from "react";
import { ShieldTask24Regular } from "@fluentui/react-icons";

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

    // Tracks whether a check has already been started once, so the button label switches to "check again".
    // The check itself is not implemented yet – the button is currently a placeholder.
    const [hasChecked, setHasChecked] = useState(false);

    const onCheckboxChange = (_event: ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
        onConfirmedChange(data.checked === true);
    };

    const onStartCheck = () => {
        // Placeholder: no check is performed yet.
        setHasChecked(true);
    };

    return (
        <Field size="large" className={styles.reviewWrapper}>
            <div className={styles.card}>
                <div className={styles.cardColumns}>
                    <div className={styles.cardLeft}>
                        <Text as="h4" size={400} weight="semibold" className={styles.columnTitle}>
                            {t("components.assistant_editor.review_intro_title")}
                        </Text>
                        <Text size={300} className={styles.columnText}>
                            {t("components.assistant_editor.review_intro_description")}
                        </Text>
                        <Link href="#/tutorials/high-risk" target="_blank" rel="noopener noreferrer" className={styles.learnMoreLink}>
                            {t("components.assistant_editor.review_check_learn_more")}
                        </Link>
                    </div>

                    <div className={styles.cardRight}>
                        <Text as="h4" size={400} weight="semibold" className={styles.columnTitle}>
                            {t("components.assistant_editor.review_check_title")}
                        </Text>
                        <Text size={300} className={styles.columnText}>
                            {t("components.assistant_editor.review_check_description")}
                        </Text>
                        <Button
                            appearance="primary"
                            icon={<ShieldTask24Regular />}
                            onClick={onStartCheck}
                            disabled={!isOwner}
                            type="button"
                            className={styles.checkButton}
                        >
                            {t(hasChecked ? "components.assistant_editor.review_check_recheck" : "components.assistant_editor.review_check_start")}
                        </Button>
                        <Text size={200} className={styles.checkDisclaimer}>
                            {t("components.assistant_editor.review_check_disclaimer")}
                        </Text>
                    </div>
                </div>
            </div>

            <div className={styles.confirmationGroup}>
                <Checkbox
                    key={confirmationResetKey}
                    checked={confirmed}
                    onChange={onCheckboxChange}
                    disabled={!isOwner}
                    required
                    className={styles.confirmationCheckbox}
                    label={t("components.assistant_editor.review_confirmation_label")}
                />
            </div>
        </Field>
    );
};

export default ReviewSection;
