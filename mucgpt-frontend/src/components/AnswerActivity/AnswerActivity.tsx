import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Caption1 } from "@fluentui/react-components";
import { CheckmarkCircle16Regular, ErrorCircle16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./AnswerActivity.module.css";
import { ActivityLine } from "./ActivityLine";
import { useIsVisibleTool } from "./useIsVisibleTool";
import { useToolIcon } from "./useToolIcon";
import { useToolDisplayName } from "../../hooks/useToolDisplayName";
import { getStepsDurationSeconds, type ActivityStep } from "../../utils/agUiActivity";

interface Props {
    steps: ActivityStep[];
}

/**
 * Compact, collapsed-by-default summary of the tool steps the agent took for an answer.
 * While a tool is still running (e.g. one started after the answer text), the header shows it live.
 */
export const AnswerActivity = ({ steps: allSteps }: Props) => {
    const { t } = useTranslation();
    const getToolDisplayName = useToolDisplayName();
    const getToolIcon = useToolIcon();
    const isVisibleTool = useIsVisibleTool();

    // Internal agent tools (planning, scratch files) are left out entirely.
    const steps = allSteps.filter(step => isVisibleTool(step.toolName));
    if (steps.length === 0) return null;

    const runningStep = steps.findLast(step => step.status === "running");
    const failedCount = steps.filter(step => step.status === "error").length;
    const duration = getStepsDurationSeconds(steps);
    const summary = [
        t("chat.activity_steps", { count: steps.length }),
        failedCount > 0 ? t("chat.activity_failed_count", { count: failedCount }) : undefined,
        duration ? t("chat.activity_duration", { seconds: duration }) : undefined
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <Accordion collapsible className={styles.activity}>
            <AccordionItem value="activity">
                <AccordionHeader size="small" expandIconPosition="end" button={{ className: styles.headerButton }}>
                    {runningStep ? (
                        <ActivityLine
                            icon={getToolIcon(runningStep.toolName)}
                            label={runningStep.description ?? t("chat.activity_running_tool", { tool: getToolDisplayName(runningStep.toolName) })}
                            startedAt={runningStep.startedAt}
                        />
                    ) : (
                        <span className={styles.line}>
                            <span className={failedCount > 0 ? styles.errorIcon : styles.icon} aria-hidden="true">
                                {failedCount > 0 ? <ErrorCircle16Regular /> : <CheckmarkCircle16Regular />}
                            </span>
                            <Caption1 className={styles.label}>{summary}</Caption1>
                        </span>
                    )}
                </AccordionHeader>
                <AccordionPanel className={styles.panel}>
                    <ol className={styles.timeline}>
                        {steps.map(step => (
                            <li key={step.toolCallId} className={styles.step}>
                                <span className={styles.rail} aria-hidden="true">
                                    <span className={step.status === "error" ? styles.errorIcon : styles.icon}>
                                        {step.status === "error" ? <ErrorCircle16Regular /> : getToolIcon(step.toolName)}
                                    </span>
                                    <span className={styles.connector} />
                                </span>
                                <Caption1 className={styles.stepLabel}>
                                    <span className={step.status === "running" ? styles.shimmer : undefined}>
                                        {step.description ?? getToolDisplayName(step.toolName)}
                                    </span>
                                    {step.status === "error" && ` – ${t("chat.activity_step_failed")}`}
                                </Caption1>
                                {step.detail && <Caption1 className={styles.detail}>{step.detail}</Caption1>}
                            </li>
                        ))}
                    </ol>
                </AccordionPanel>
            </AccordionItem>
        </Accordion>
    );
};
