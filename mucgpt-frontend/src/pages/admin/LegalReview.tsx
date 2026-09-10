import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Body1, Button, Card, Field, MessageBar, MessageBarBody, Spinner, Textarea, Title1 } from "@fluentui/react-components";
import { Checkmark24Regular, Dismiss24Regular, Eye24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import { getAssistantReviewQueueApi, updateAssistantStateApi } from "../../api/assistant-client";
import { AssistantResponse, AssistantState } from "../../api/models";
import { ApiError } from "../../api/fetch-utils";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { UserContext } from "../layout/UserContextProvider";
import styles from "./LegalReview.module.css";

const LegalReview = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdmin, isLoading: isLoadingUser } = useContext(UserContext);
    const [assistants, setAssistants] = useState<AssistantResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantResponse | null>(null);

    const loadQueue = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setAssistants(await getAssistantReviewQueueApi());
        } catch (loadError) {
            if (loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403)) {
                navigate("/unauthorized");
                return;
            }
            setError(loadError instanceof Error ? loadError.message : t("admin.legal_review.load_failed"));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoadingUser && isAdmin) void loadQueue();
    }, [isAdmin, isLoadingUser]);

    if (isLoadingUser)
        return (
            <div className={styles.centered}>
                <Spinner label={t("common.loading")} />
            </div>
        );
    if (!isAdmin)
        return (
            <div className={styles.centered}>
                <MessageBar intent="error">
                    <MessageBarBody>{t("common.errors.unauthorized_title")}</MessageBarBody>
                </MessageBar>
            </div>
        );

    const selectedAssistantCard: AssistantCardData | null = selectedAssistant
        ? {
              id: selectedAssistant.id,
              title: selectedAssistant.latest_version.name,
              description: selectedAssistant.latest_version.description || "",
              subscriptions: selectedAssistant.subscriptions_count,
              updated: selectedAssistant.updated_at,
              tags: selectedAssistant.latest_version.tags || [],
              rawData: selectedAssistant
          }
        : null;

    const updateState = async (assistant: AssistantResponse, state: AssistantState) => {
        const version = assistant.latest_version;
        setSavingId(assistant.id);
        setError(null);
        try {
            await updateAssistantStateApi(assistant.id, {
                state,
                expected_state: "pending_legal_review",
                version: version.version,
                reason: reason[assistant.id]?.trim() || undefined
            });
            setAssistants(current => current.filter(item => item.id !== assistant.id));
            setSelectedAssistant(current => (current?.id === assistant.id ? null : current));
        } catch (updateError) {
            if (updateError instanceof ApiError && updateError.status === 409) {
                setError(t("admin.legal_review.conflict"));
                void loadQueue();
            } else {
                setError(updateError instanceof Error ? updateError.message : t("admin.legal_review.update_failed"));
            }
        } finally {
            setSavingId(null);
        }
    };

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerCopy}>
                    <Title1>{t("admin.legal_review.title")}</Title1>
                    <Body1>{t("admin.legal_review.subtitle")}</Body1>
                </div>
                <Button appearance="subtle" onClick={() => void loadQueue()}>
                    {t("common.refresh", "Refresh")}
                </Button>
            </header>
            {error && (
                <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {isLoading ? (
                <div className={styles.centered}>
                    <Spinner label={t("common.loading")} />
                </div>
            ) : assistants.length === 0 ? (
                <MessageBar intent="success">
                    <MessageBarBody>{t("admin.legal_review.empty")}</MessageBarBody>
                </MessageBar>
            ) : (
                <div className={styles.list}>
                    {assistants.map(assistant => {
                        const version = assistant.latest_version;
                        return (
                            <Card key={assistant.id} className={styles.card} appearance="outline">
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitleBlock}>
                                        <h2 className={styles.name}>{version.name}</h2>
                                        <Body1>{version.description}</Body1>
                                    </div>
                                    <Badge color="warning">{t("admin.legal_review.pending")}</Badge>
                                </div>
                                <div className={styles.cardMetadata}>
                                    <span>{t("admin.legal_review.version", { version: version.version })}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{t("admin.legal_review.pending")}</span>
                                </div>
                                {version.compliance_check_result?.results
                                    .filter(result => result.status === "high_risk_detected")
                                    .map(result => (
                                        <MessageBar key={result.category} intent="warning" className={styles.finding}>
                                            <MessageBarBody>
                                                <strong>{result.category}</strong>
                                                {result.reasoning ? `: ${result.reasoning}` : ""}
                                            </MessageBarBody>
                                        </MessageBar>
                                    ))}
                                <Field label={t("admin.legal_review.reason_label")} hint={t("admin.legal_review.reason_hint")}>
                                    <Textarea
                                        value={reason[assistant.id] || ""}
                                        onChange={(_event, data) => setReason(current => ({ ...current, [assistant.id]: data.value }))}
                                    />
                                </Field>
                                <div className={styles.actions}>
                                    <Button appearance="secondary" icon={<Eye24Regular />} onClick={() => setSelectedAssistant(assistant)}>
                                        {t("admin.legal_review.view_details", "View details")}
                                    </Button>
                                    <Button
                                        appearance="primary"
                                        icon={<Checkmark24Regular />}
                                        disabled={savingId !== null}
                                        onClick={() => void updateState(assistant, "active")}
                                    >
                                        {t("admin.legal_review.approve")}
                                    </Button>
                                    <Button
                                        appearance="secondary"
                                        icon={<Dismiss24Regular />}
                                        disabled={savingId !== null}
                                        onClick={() => void updateState(assistant, "inactive")}
                                    >
                                        {t("admin.legal_review.deactivate")}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
            <AssistantDetailsSidebar
                isOpen={selectedAssistant !== null}
                onClose={() => setSelectedAssistant(null)}
                assistant={selectedAssistantCard}
                ownedAssistantIds={new Set()}
                hideStartChat
            />
        </main>
    );
};

export default LegalReview;
