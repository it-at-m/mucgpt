import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Caption1, Spinner } from "@fluentui/react-components";
import { CheckmarkCircle16Regular, ErrorCircle16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./AnswerActivity.module.css";
import { useToolDisplayName } from "../../hooks/useToolDisplayName";
import type { ActivityStep } from "../../utils/agUiActivity";

interface Props {
    steps: ActivityStep[];
}

const StepIcon = ({ status }: { status: ActivityStep["status"] }) => {
    if (status === "running") return <Spinner size="extra-tiny" />;
    if (status === "error") return <ErrorCircle16Regular className={styles.errorIcon} />;
    return <CheckmarkCircle16Regular className={styles.doneIcon} />;
};

/**
 * Compact, collapsed-by-default summary of the tool steps the agent took for an answer.
 * While a tool is still running (e.g. one started after the answer text), the header shows it.
 */
export const AnswerActivity = ({ steps }: Props) => {
    const { t } = useTranslation();
    const getToolDisplayName = useToolDisplayName();

    const runningStep = steps.findLast(step => step.status === "running");
    const hasError = steps.some(step => step.status === "error");
    const toolNames = [...new Set(steps.map(step => getToolDisplayName(step.toolName)))].join(", ");
    const summary = runningStep
        ? t("chat.activity_running_tool", { tool: getToolDisplayName(runningStep.toolName) })
        : `${t("chat.activity_steps", { count: steps.length })} · ${toolNames}`;

    return (
        <Accordion collapsible className={styles.activity}>
            <AccordionItem value="activity">
                <AccordionHeader size="small" expandIconPosition="end" icon={<StepIcon status={runningStep ? "running" : hasError ? "error" : "done"} />}>
                    <Caption1 className={styles.summary}>{summary}</Caption1>
                </AccordionHeader>
                <AccordionPanel>
                    <ol className={styles.steps}>
                        {steps.map(step => (
                            <li key={step.toolCallId} className={styles.step}>
                                <StepIcon status={step.status} />
                                <Caption1>
                                    {getToolDisplayName(step.toolName)}
                                    {step.status === "error" && ` – ${t("chat.activity_step_failed")}`}
                                </Caption1>
                            </li>
                        ))}
                    </ol>
                </AccordionPanel>
            </AccordionItem>
        </Accordion>
    );
};
