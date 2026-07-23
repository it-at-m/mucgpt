import { Button, Checkbox, CheckboxOnChangeData, Field, Link, MessageBar, MessageBarBody, MessageBarTitle, Spinner, Text } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ShieldTask24Regular } from "@fluentui/react-icons";

import styles from "./ReviewSection.module.css";
import { ComplianceCheckResponse } from "../../../../api";

interface ReviewSectionProps {
    confirmed: boolean;
    // Changes whenever the confirmation is reset, forcing the checkbox to remount so it reliably reflects the cleared state.
    confirmationResetKey: number;
    // Result of the last compliance check for the current system prompt, if any.
    checkResult: ComplianceCheckResponse | null;
    checkLoading: boolean;
    isOwner: boolean;
    onConfirmedChange: (confirmed: boolean) => void;
    onStartCheck: () => void;
}

export const ReviewSection = ({ confirmed, confirmationResetKey, checkResult, checkLoading, isOwner, onConfirmedChange, onStartCheck }: ReviewSectionProps) => {
    const { t } = useTranslation();

    const confirmationRef = useRef<HTMLDivElement>(null);
    const [highlightConfirmation, setHighlightConfirmation] = useState(false);

    const onCheckboxChange = (_event: ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => {
        onConfirmedChange(data.checked === true);
    };

    const highRiskResults = checkResult?.results.filter(result => result.status === "high_risk_detected") ?? [];
    const hasHighRisk = checkResult?.overall_status === "high_risk_detected";
    const passed = checkResult?.overall_status === "passed";
    const showError = checkResult?.overall_status === "error";
    // The confirmation becomes available once a check has run. On error we intentionally do not block the user,
    // since the check failing is rare and should not prevent saving.
    const checkCompleted = checkResult !== null;
    // Only a usable (non-error) result guides the user to the confirmation.
    const hasUsableResult = passed || hasHighRisk;

    // After a completed check, guide the user to the now-enabled confirmation: scroll it into view and highlight it briefly.
    useEffect(() => {
        if (!hasUsableResult) {
            setHighlightConfirmation(false);
            return;
        }

        confirmationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightConfirmation(true);
        const timeout = window.setTimeout(() => setHighlightConfirmation(false), 2500);
        return () => window.clearTimeout(timeout);
    }, [hasUsableResult, checkResult]);

    return (
        <Field size="large" className={styles.reviewWrapper}>
            <div className={styles.card}>
                <div className={styles.cardColumns}>
                    <div className={styles.cardLeft}>
                        <Text as="h4" weight="semibold" className={styles.columnTitle}>
                            {t("components.assistant_editor.review_intro_title")}
                        </Text>
                        <Text className={styles.columnText}>{t("components.assistant_editor.review_intro_description")}</Text>
                        <Link href="#/tutorials/high-risk" target="_blank" rel="noopener noreferrer" className={styles.learnMoreLink}>
                            {t("components.assistant_editor.review_check_learn_more")}
                        </Link>
                    </div>

                    <div className={styles.cardRight}>
                        <Text as="h4" weight="semibold" className={styles.columnTitle}>
                            {t("components.assistant_editor.review_check_title")} <span className={styles.requiredMark}>*</span>
                        </Text>
                        <Text className={styles.columnText}>{t("components.assistant_editor.review_check_description")}</Text>
                        <Button
                            appearance="primary"
                            icon={checkLoading ? <Spinner size="tiny" /> : <ShieldTask24Regular />}
                            onClick={onStartCheck}
                            disabled={!isOwner || checkLoading}
                            type="button"
                            className={styles.checkButton}
                        >
                            {t(
                                checkLoading
                                    ? "components.assistant_editor.review_check_running"
                                    : checkCompleted
                                      ? "components.assistant_editor.review_check_recheck"
                                      : "components.assistant_editor.review_check_start"
                            )}
                        </Button>
                    </div>
                </div>

                {showError && (
                    <MessageBar intent="error" layout="multiline" className={styles.resultMessageBar}>
                        <MessageBarBody className={styles.resultBody}>
                            <MessageBarTitle>{t("components.assistant_editor.review_result_error_title")}</MessageBarTitle>
                            <Text as="p" className={styles.resultText}>
                                {t("components.assistant_editor.review_result_error_description")}
                            </Text>
                        </MessageBarBody>
                    </MessageBar>
                )}

                {passed && (
                    <MessageBar intent="success" layout="multiline" className={styles.resultMessageBar}>
                        <MessageBarBody className={styles.resultBody}>
                            <MessageBarTitle>{t("components.assistant_editor.review_result_passed_title")}</MessageBarTitle>
                            <Text as="p" className={styles.resultText}>
                                {t("components.assistant_editor.review_result_passed_description")}
                            </Text>
                        </MessageBarBody>
                    </MessageBar>
                )}

                {hasHighRisk && (
                    <div className={styles.resultGroup}>
                        <MessageBar intent="warning" layout="multiline" className={styles.resultMessageBar}>
                            <MessageBarBody className={styles.resultBody}>
                                <MessageBarTitle>{t("components.assistant_editor.review_result_warning_title")}</MessageBarTitle>
                                <Text as="p" className={styles.resultText}>
                                    {t("components.assistant_editor.review_result_warning_guidance")}
                                </Text>
                            </MessageBarBody>
                        </MessageBar>
                        <ul className={styles.findingList}>
                            {highRiskResults.map(result => (
                                <li key={result.category} className={styles.findingItem}>
                                    <Text weight="semibold" as="p" className={styles.findingCategory}>
                                        {t(`components.assistant_editor.review_category_${result.category}`)}
                                    </Text>
                                    {result.reasoning && (
                                        <Text as="p" className={styles.findingReasoning}>
                                            {result.reasoning}
                                        </Text>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div
                ref={confirmationRef}
                className={[styles.confirmationGroup, highlightConfirmation ? styles.confirmationHighlight : ""].filter(Boolean).join(" ")}
            >
                <Checkbox
                    key={confirmationResetKey}
                    checked={confirmed}
                    onChange={onCheckboxChange}
                    disabled={!isOwner || !checkCompleted}
                    required
                    className={styles.confirmationCheckbox}
                    label={t(
                        hasHighRisk
                            ? "components.assistant_editor.review_confirmation_label_high_risk"
                            : "components.assistant_editor.review_confirmation_label"
                    )}
                />
            </div>
        </Field>
    );
};

export default ReviewSection;
