import { useEffect, useRef, useState } from "react";
import { Shield16Regular, Warning16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./ToolApproval.module.css";
import { useToolIcon } from "../AnswerActivity/useToolIcon";
import { useToolDisplayName } from "../../hooks/useToolDisplayName";
import { Button } from "../../ui/Button";
import type { ToolApprovalRequest, ToolDecision, ToolDecisions } from "../../utils/toolApproval";

interface Props {
    requests: ToolApprovalRequest[];
    onSubmit: (decisions: ToolDecisions) => void;
}

const MIN_MS_BETWEEN_DECISIONS = 500;

const toDisplayValue = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

export const ToolApproval = ({ requests, onSubmit }: Props) => {
    const { t } = useTranslation();
    const getToolDisplayName = useToolDisplayName();
    const getToolIcon = useToolIcon();
    const [decisions, setDecisions] = useState<ToolDecisions>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const lastDecisionAtRef = useRef(0);
    const decidedCount = Object.keys(decisions).length;

    useEffect(() => {
        if (decidedCount > 0) containerRef.current?.focus();
    }, [decidedCount]);

    const decide = (id: string, decision: ToolDecision) => {
        const now = Date.now();
        if (now - lastDecisionAtRef.current < MIN_MS_BETWEEN_DECISIONS) return;
        lastDecisionAtRef.current = now;
        const nextDecisions = { ...decisions, [id]: decision };
        setDecisions(nextDecisions);
        if (requests.every(request => nextDecisions[request.id])) onSubmit(nextDecisions);
    };

    return (
        <div ref={containerRef} className={styles.requests} role="status" tabIndex={-1}>
            {requests
                .filter(request => !decisions[request.id])
                .slice(0, 1)
                .map(request => {
                    const tool = getToolDisplayName(request.toolName);
                    const args = Object.entries(request.args);
                    const isPublicOnly = request.dataClassification === "public";
                    return (
                        <section key={request.id} className={styles.request} aria-label={t("chat.tool_approval_title", { tool })}>
                            <span className={styles.icon} aria-hidden="true">
                                {getToolIcon(request.toolName)}
                            </span>
                            <div className={styles.header}>
                                <p className={styles.title}>{t("chat.tool_approval_title", { tool })}</p>
                                {requests.length > 1 && (
                                    <span className={styles.position}>
                                        {t("chat.tool_approval_position", { current: decidedCount + 1, total: requests.length })}
                                    </span>
                                )}
                            </div>
                            <div className={styles.card}>
                                {args.length > 0 && (
                                    <div className={styles.content}>
                                        <p className={styles.label}>{t("chat.tool_approval_sent")}</p>
                                        <dl className={styles.args}>
                                            {args.map(([name, value]) => (
                                                <div key={name} className={styles.arg}>
                                                    <dt className={styles.argName}>{name}</dt>
                                                    <dd className={styles.argValue}>{toDisplayValue(value)}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>
                                )}
                                <div className={styles.footer}>
                                    <p className={isPublicOnly ? styles.publicOnly : styles.classification}>
                                        <span className={styles.classificationIcon} aria-hidden="true">
                                            {isPublicOnly ? <Warning16Regular /> : <Shield16Regular />}
                                        </span>
                                        <span>{t(`chat.tool_approval_classification_${request.dataClassification}`, { tool })}</span>
                                    </p>
                                    <div className={styles.actions}>
                                        <Button aria-label={t("chat.tool_approval_reject_label", { tool })} onClick={() => decide(request.id, "reject")}>
                                            {t("chat.tool_approval_reject")}
                                        </Button>
                                        <Button
                                            appearance="primary"
                                            aria-label={t("chat.tool_approval_approve_label", { tool })}
                                            onClick={() => decide(request.id, "approve")}
                                        >
                                            {t("chat.tool_approval_approve")}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    );
                })}
        </div>
    );
};
