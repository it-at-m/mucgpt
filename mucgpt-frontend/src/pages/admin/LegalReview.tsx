import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Body1, Button, Card, Field, MessageBar, MessageBarBody, Spinner, Textarea, Title1 } from "@fluentui/react-components";
import {
    ArrowRight24Regular,
    CalendarLtr24Regular,
    Checkmark24Regular,
    Dismiss24Regular,
    DocumentText24Regular,
    Globe24Regular,
    Lightbulb24Regular,
    Settings24Regular,
    Sparkle24Regular,
    Tag24Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import { getAssistantReviewQueueApi, updateAssistantStateApi } from "../../api/assistant-client";
import { AssistantResponse, AssistantState } from "../../api/models";
import { ApiError } from "../../api/fetch-utils";
import { getPrimaryOwnerDetails, OwnerMetadataLink } from "../../components/OwnerMetadataLink/OwnerMetadataLink";
import { MarkdownRenderer } from "../../components/MarkdownRenderer/MarkdownRenderer";
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
            const queue = await getAssistantReviewQueueApi();
            setAssistants(queue);
            setSelectedAssistant(current => (current && queue.some(item => item.id === current.id) ? current : (queue[0] ?? null)));
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

    const updateState = async (assistant: AssistantResponse, state: AssistantState) => {
        const version = assistant.latest_version;
        const trimmedReason = reason[assistant.id]?.trim() || "";
        if (!trimmedReason) return;

        setSavingId(assistant.id);
        setError(null);
        try {
            await updateAssistantStateApi(assistant.id, {
                state,
                expected_state: "pending_legal_review",
                version: version.version,
                reason: trimmedReason
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
                <div className={styles.workspace}>
                    <section className={styles.queue} aria-label={t("admin.legal_review.queue", "Review queue")}>
                        <div className={styles.queueHeader}>
                            <strong>{t("admin.legal_review.queue", "Review queue")}</strong>
                            <Badge appearance="tint" color="warning">
                                {assistants.length}
                            </Badge>
                        </div>
                        <div className={styles.list}>
                            {assistants.map(assistant => {
                                const version = assistant.latest_version;
                                const isSelected = selectedAssistant?.id === assistant.id;
                                return (
                                    <Card
                                        key={assistant.id}
                                        className={`${styles.card} ${isSelected ? styles.selectedCard : ""}`}
                                        appearance="outline"
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isSelected}
                                        onClick={() => setSelectedAssistant(assistant)}
                                        onKeyDown={event => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setSelectedAssistant(assistant);
                                            }
                                        }}
                                    >
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
                                            <OwnerMetadataLink
                                                owner={getPrimaryOwnerDetails(assistant)}
                                                fallbackLabel={t("admin.legal_review.unknown_author", "Unknown author")}
                                            />
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                    {selectedAssistant ? (
                        <ReviewDetails
                            assistant={selectedAssistant}
                            reason={reason[selectedAssistant.id] || ""}
                            saving={savingId === selectedAssistant.id || savingId !== null}
                            onReasonChange={value => setReason(current => ({ ...current, [selectedAssistant.id]: value }))}
                            onDecision={state => void updateState(selectedAssistant, state)}
                        />
                    ) : (
                        <section className={styles.noSelection}>
                            <Body1>{t("admin.legal_review.select_assistant", "Select an assistant to review")}</Body1>
                        </section>
                    )}
                </div>
            )}
        </main>
    );
};

interface ReviewDetailsProps {
    assistant: AssistantResponse;
    reason: string;
    saving: boolean;
    onReasonChange: (value: string) => void;
    onDecision: (state: AssistantState) => void;
}

const ReviewDetails = ({ assistant, reason, saving, onReasonChange, onDecision }: ReviewDetailsProps) => {
    const { t, i18n } = useTranslation();
    const version = assistant.latest_version;
    const owners = assistant.owners_detailed || version.owners_detailed || [];
    const formatDate = (value: string) =>
        new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    const visibilityLabel = assistant.is_visible ? t("admin.legal_review.public", "Publicly visible") : t("admin.legal_review.private", "Private");

    return (
        <section className={styles.details} aria-labelledby="review-details-title">
            <div className={styles.detailsHeader}>
                <div>
                    <div className={styles.eyebrow}>{t("admin.legal_review.details", "Assistant details")}</div>
                    <h2 id="review-details-title" className={styles.detailsTitle}>
                        {version.name}
                    </h2>
                    <Body1 className={styles.detailsDescription}>
                        {version.description || t("admin.legal_review.no_description", "No description provided.")}
                    </Body1>
                </div>
                <Badge color="warning" size="large">
                    {t("admin.legal_review.pending")}
                </Badge>
            </div>

            <div className={styles.authorRow}>
                <span className={styles.label}>{t("admin.legal_review.author", "Author")}</span>
                <div className={styles.ownerLinks}>
                    {owners.length > 0 ? (
                        owners.map(owner => <OwnerMetadataLink key={owner.user_id} owner={owner} />)
                    ) : (
                        <span>{t("admin.legal_review.unknown_author", "Unknown author")}</span>
                    )}
                </div>
            </div>

            <div className={styles.detailGrid}>
                <DetailSection title={t("admin.legal_review.system_prompt", "System prompt")} icon={<DocumentText24Regular />} className={styles.promptSection}>
                    <div className={styles.prompt}>
                        <MarkdownRenderer>{version.system_prompt}</MarkdownRenderer>
                    </div>
                </DetailSection>
                <DetailSection title={t("admin.legal_review.configuration", "Configuration")} icon={<Settings24Regular />}>
                    <dl className={styles.infoList}>
                        <InfoRow label={t("admin.legal_review.model", "Model")} value={version.default_model || t("admin.legal_review.not_set", "Not set")} />
                        <InfoRow label={t("admin.legal_review.creativity", "Creativity")} value={version.creativity} />
                        <InfoRow label={t("admin.legal_review.visibility", "Visibility")} value={visibilityLabel} />
                        <InfoRow label={t("admin.legal_review.subscribers", "Subscribers")} value={String(assistant.subscriptions_count)} />
                        <InfoRow label={t("admin.legal_review.version", { version: "" }).replace(/\s*$/, "")} value={String(version.version)} />
                    </dl>
                </DetailSection>
                <DetailSection
                    title={t("admin.legal_review.compliance_findings", "Compliance findings")}
                    icon={<Globe24Regular />}
                    className={styles.findingsSection}
                >
                    {version.compliance_check_result?.results?.map(result => (
                        <div key={result.category} className={`${styles.complianceRow} ${result.status === "high_risk_detected" ? styles.highRisk : ""}`}>
                            <div>
                                <strong>{result.category}</strong>
                                <span className={styles.complianceStatus}>{result.status}</span>
                            </div>
                            {result.reasoning && <Body1>{result.reasoning}</Body1>}
                        </div>
                    )) || <Body1>{t("admin.legal_review.no_findings", "No compliance results available.")}</Body1>}
                </DetailSection>
                <DetailSection title={t("admin.legal_review.capabilities", "Capabilities")} icon={<Sparkle24Regular />}>
                    <div className={styles.chips}>
                        {(version.tools || []).map(tool => (
                            <Badge key={tool.id} appearance="tint">
                                {tool.id}
                            </Badge>
                        ))}
                    </div>
                    {(version.tools || []).length === 0 && <Body1>{t("admin.legal_review.no_tools", "No tools enabled.")}</Body1>}
                </DetailSection>
                {(version.examples || []).length > 0 && (
                    <DetailSection title={t("admin.legal_review.starter_prompts", "Starter prompts")} icon={<Lightbulb24Regular />}>
                        <ul className={styles.itemList}>
                            {version.examples?.map((item, index) => (
                                <li key={`${item.text}-${index}`}>
                                    {item.text}
                                    <span>{item.value}</span>
                                </li>
                            ))}
                        </ul>
                    </DetailSection>
                )}
                {(version.quick_prompts || []).length > 0 && (
                    <DetailSection title={t("admin.legal_review.follow_up_actions", "Follow-up actions")} icon={<ArrowRight24Regular />}>
                        <ul className={styles.itemList}>
                            {version.quick_prompts?.map(item => (
                                <li key={item.id || item.label}>
                                    {item.label}
                                    <span>{item.prompt}</span>
                                </li>
                            ))}
                        </ul>
                    </DetailSection>
                )}
                <DetailSection title={t("admin.legal_review.access_and_tags", "Access and tags")} icon={<Tag24Regular />}>
                    <div className={styles.chips}>
                        {(version.tags || []).map(tag => (
                            <Badge key={tag} appearance="outline">
                                {tag}
                            </Badge>
                        ))}
                        {(version.tags || []).length === 0 && <Body1>{t("admin.legal_review.no_tags", "No tags.")}</Body1>}
                    </div>
                    {version.hierarchical_access && version.hierarchical_access.length > 0 && (
                        <div className={styles.accessList}>
                            {version.hierarchical_access.map(path => (
                                <span key={path}>{path}</span>
                            ))}
                        </div>
                    )}
                </DetailSection>
            </div>

            <div className={styles.recordMeta}>
                <span>
                    <CalendarLtr24Regular />
                    {t("admin.legal_review.created", "Created")}: {formatDate(assistant.created_at)}
                </span>
                <span>
                    <CalendarLtr24Regular />
                    {t("admin.legal_review.updated", "Updated")}: {formatDate(assistant.updated_at)}
                </span>
                <span>ID: {assistant.id}</span>
            </div>
            <div className={styles.decisionPanel}>
                <Field label={t("admin.legal_review.reason_label")} hint={t("admin.legal_review.reason_hint")}>
                    <Textarea value={reason} onChange={(_event, data) => onReasonChange(data.value)} />
                </Field>
                <div className={styles.actions}>
                    <Button appearance="primary" icon={<Checkmark24Regular />} disabled={saving || !reason.trim()} onClick={() => onDecision("active")}>
                        {t("admin.legal_review.approve")}
                    </Button>
                    <Button appearance="secondary" icon={<Dismiss24Regular />} disabled={saving || !reason.trim()} onClick={() => onDecision("inactive")}>
                        {t("admin.legal_review.deactivate")}
                    </Button>
                </div>
            </div>
        </section>
    );
};

const DetailSection = ({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) => (
    <div className={`${styles.detailSection} ${className}`}>
        <h3 className={styles.sectionTitle}>
            {icon}
            {title}
        </h3>
        {children}
    </div>
);
const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className={styles.infoRow}>
        <dt>{label}</dt>
        <dd>{value}</dd>
    </div>
);

export default LegalReview;
