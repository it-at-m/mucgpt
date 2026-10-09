import { type TransitionEvent, useContext, useDeferredValue, useEffect, useRef, useState } from "react";
import {
    Badge,
    Body1,
    Body2,
    Button,
    Card,
    Dropdown,
    Field,
    MessageBar,
    MessageBarBody,
    Option,
    Radio,
    RadioGroup,
    SearchBox,
    Spinner,
    Title1,
    Title3
} from "@fluentui/react-components";
import { ArrowResetRegular, ArrowSyncRegular, Eye24Regular, EyeOff24Regular, People24Regular, PeopleRegular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { type AdminAssistantListQueryParams, type AssistantAccessType, type ComplianceStatus, getAdminAssistantsApi } from "../../api/assistant-client";
import { type AssistantResponse, type AssistantState } from "../../api/models";
import { ApiError } from "../../api/fetch-utils";
import { AssistantDetailsSidebar, type AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { getPrimaryOwnerDetails, OwnerMetadataLink } from "../../components/OwnerMetadataLink/OwnerMetadataLink";
import DepartmentTreeDropdown from "../../components/DepartmentTreeDropdown/DepartmentTreeDropdown";
import { UserContext } from "../layout/UserContextProvider";
import styles from "./AdminAssistants.module.css";

const PAGE_SIZE = 50;
const NO_OWNED_ASSISTANTS = new Set<string>();

const getAccessType = (assistant: AssistantResponse): AssistantAccessType => {
    if (!assistant.is_visible) return "private";
    if ((assistant.hierarchical_access || []).length > 0) return "hierarchical";
    return "public";
};

const accessLabel = (assistant: AssistantResponse, t: (key: string) => string) => {
    return t(`admin.assistants.access_${getAccessType(assistant)}`);
};

const stateBadge = (state: AssistantState | undefined, t: (key: string) => string) => {
    if (state === "pending_legal_review") return { color: "warning" as const, label: t("admin.assistants.state_pending") };
    if (state === "inactive") return { color: "danger" as const, label: t("admin.assistants.state_inactive") };
    return { color: "success" as const, label: t("admin.assistants.state_active") };
};

const complianceBadge = (status: ComplianceStatus | undefined, t: (key: string) => string) => {
    if (status === "high_risk_detected") return { color: "warning" as const, label: t("admin.assistants.compliance_high_risk") };
    if (status === "error") return { color: "danger" as const, label: t("admin.assistants.compliance_error") };
    if (status === "passed") return { color: "success" as const, label: t("admin.assistants.compliance_passed") };
    return { color: undefined, label: t("admin.assistants.compliance_not_checked") };
};

const AdminAssistants = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { isAdmin, isLoading: isLoadingUser } = useContext(UserContext);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [state, setState] = useState<AssistantState | undefined>();
    const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | undefined>();
    const [access, setAccess] = useState<AssistantAccessType | undefined>();
    const [departments, setDepartments] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<NonNullable<AdminAssistantListQueryParams["sort_by"]>>("updated");
    const [sortOrder, setSortOrder] = useState<NonNullable<AdminAssistantListQueryParams["sort_order"]>>("desc");
    const [assistants, setAssistants] = useState<AssistantResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const requestVersion = useRef(0);

    const query: AdminAssistantListQueryParams = {
        state,
        compliance_status: complianceStatus,
        access,
        department: departments[0],
        search: deferredSearch,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: PAGE_SIZE
    };

    useEffect(() => {
        if (isLoadingUser || !isAdmin) return;

        const controller = new AbortController();
        requestVersion.current += 1;
        setIsLoading(true);
        setIsLoadingMore(false);
        setError(null);
        void getAdminAssistantsApi(query, { signal: controller.signal })
            .then(response => {
                setAssistants(response);
                setHasMore(response.length === PAGE_SIZE);
            })
            .catch(loadError => {
                if (controller.signal.aborted) return;
                if (loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403)) {
                    navigate("/unauthorized");
                    return;
                }
                setAssistants([]);
                setHasMore(false);
                setError(loadError instanceof Error ? loadError.message : t("admin.assistants.load_failed"));
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [access, complianceStatus, departments, deferredSearch, isAdmin, isLoadingUser, navigate, refreshKey, sortBy, sortOrder, state, t]);

    const loadMore = async () => {
        const currentRequestVersion = requestVersion.current;
        setIsLoadingMore(true);
        try {
            const response = await getAdminAssistantsApi({ ...query, offset: assistants.length });
            if (requestVersion.current !== currentRequestVersion) return;
            setAssistants(current => [...current, ...response]);
            setHasMore(response.length === PAGE_SIZE);
        } catch (loadError) {
            if (requestVersion.current !== currentRequestVersion) return;
            setError(loadError instanceof Error ? loadError.message : t("admin.assistants.load_failed"));
        } finally {
            if (requestVersion.current === currentRequestVersion) setIsLoadingMore(false);
        }
    };

    const clearFilters = () => {
        setSearch("");
        setState(undefined);
        setComplianceStatus(undefined);
        setAccess(undefined);
        setDepartments([]);
        setSortBy("updated");
        setSortOrder("desc");
    };

    const hasFilters = Boolean(search || state || complianceStatus || access || departments.length > 0 || sortBy !== "updated" || sortOrder !== "desc");

    const handleAccessChange = (value: AssistantAccessType | undefined) => {
        setAccess(value);
        if (value !== "hierarchical") setDepartments([]);
    };

    const openDetails = (assistant: AssistantResponse) => {
        const version = assistant.latest_version;
        setSelectedAssistant({
            id: assistant.id,
            title: version.name,
            description: version.description || "",
            subscriptions: assistant.subscriptions_count,
            updated: assistant.updated_at,
            tags: version.tags || [],
            rawData: assistant
        });
        setIsDetailsOpen(true);
    };

    const closeDetails = () => setIsDetailsOpen(false);

    const handleDetailsSlotTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || event.propertyName !== "flex-basis" || isDetailsOpen) return;
        setSelectedAssistant(null);
    };

    if (isLoadingUser) {
        return <LoadingState label={t("common.loading")} />;
    }
    if (!isAdmin) {
        return (
            <div className={styles.centered}>
                <MessageBar intent="error">
                    <MessageBarBody>{t("common.errors.unauthorized_title")}</MessageBarBody>
                </MessageBar>
            </div>
        );
    }

    const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { dateStyle: "medium", timeStyle: "short" });
    const assistantGroups = (["public", "private", "hierarchical"] as const).map(accessType => ({
        accessType,
        label: t(`admin.assistants.access_${accessType}`),
        assistants: assistants.filter(assistant => getAccessType(assistant) === accessType)
    }));

    return (
        <div className={styles.pageWrapper} data-drawer-open={isDetailsOpen}>
            <main className={styles.page}>
                <div className={styles.contentWrapper}>
                    <header className={styles.header}>
                        <div className={styles.headerCopy}>
                            <Title1>{t("admin.assistants.title")}</Title1>
                            <Body1>{t("admin.assistants.subtitle")}</Body1>
                        </div>
                        <Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => setRefreshKey(current => current + 1)}>
                            {t("common.refresh", "Refresh")}
                        </Button>
                    </header>

                    <section className={styles.filters} aria-label={t("admin.assistants.filters")}>
                        <SearchBox
                            className={styles.search}
                            value={search}
                            onChange={(_, data) => setSearch(data.value)}
                            placeholder={t("admin.assistants.search_placeholder")}
                            aria-label={t("admin.assistants.search_placeholder")}
                        />
                        <Dropdown
                            selectedOptions={state ? [state] : []}
                            onOptionSelect={(_, data) => setState((data.optionValue as AssistantState) || undefined)}
                            placeholder={t("admin.assistants.all_states")}
                            aria-label={t("admin.assistants.all_states")}
                        >
                            <Option value="">{t("admin.assistants.all_states")}</Option>
                            <Option value="active">{t("admin.assistants.state_active")}</Option>
                            <Option value="pending_legal_review">{t("admin.assistants.state_pending")}</Option>
                            <Option value="inactive">{t("admin.assistants.state_inactive")}</Option>
                        </Dropdown>
                        <Dropdown
                            selectedOptions={complianceStatus ? [complianceStatus] : []}
                            onOptionSelect={(_, data) => setComplianceStatus((data.optionValue as ComplianceStatus) || undefined)}
                            placeholder={t("admin.assistants.all_compliance")}
                            aria-label={t("admin.assistants.all_compliance")}
                        >
                            <Option value="">{t("admin.assistants.all_compliance")}</Option>
                            <Option value="passed">{t("admin.assistants.compliance_passed")}</Option>
                            <Option value="high_risk_detected">{t("admin.assistants.compliance_high_risk")}</Option>
                            <Option value="error">{t("admin.assistants.compliance_error")}</Option>
                        </Dropdown>
                        <Field className={styles.accessFilter} label={t("admin.assistants.all_access")}>
                            <RadioGroup
                                value={access || "all"}
                                onChange={(_, data) => handleAccessChange(data.value === "all" ? undefined : (data.value as AssistantAccessType))}
                            >
                                <Radio value="all" label={t("admin.assistants.all_access")} />
                                <Radio
                                    value="public"
                                    label={
                                        <span className={styles.accessOption}>
                                            <Eye24Regular />
                                            <span>{t("admin.assistants.access_public")}</span>
                                        </span>
                                    }
                                />
                                <Radio
                                    value="hierarchical"
                                    label={
                                        <span className={styles.accessOption}>
                                            <People24Regular />
                                            <span>{t("admin.assistants.access_hierarchical")}</span>
                                        </span>
                                    }
                                />
                                {access === "hierarchical" && (
                                    <div className={styles.departmentPicker}>
                                        <DepartmentTreeDropdown publishDepartments={departments} setPublishDepartments={setDepartments} multiple={false} />
                                    </div>
                                )}
                                <Radio
                                    value="private"
                                    label={
                                        <span className={styles.accessOption}>
                                            <EyeOff24Regular />
                                            <span>{t("admin.assistants.access_private")}</span>
                                        </span>
                                    }
                                />
                            </RadioGroup>
                        </Field>
                        <div className={styles.sortControls}>
                            <Dropdown
                                value={sortBy}
                                selectedOptions={[sortBy]}
                                onOptionSelect={(_, data) => setSortBy(data.optionValue as typeof sortBy)}
                                aria-label={t("admin.assistants.sort_by")}
                            >
                                <Option value="updated">{t("admin.assistants.sort_updated")}</Option>
                                <Option value="title">{t("admin.assistants.sort_title")}</Option>
                                <Option value="subscriptions">{t("admin.assistants.sort_subscriptions")}</Option>
                            </Dropdown>
                            <Dropdown
                                value={sortOrder}
                                selectedOptions={[sortOrder]}
                                onOptionSelect={(_, data) => setSortOrder(data.optionValue as typeof sortOrder)}
                                aria-label={t("admin.assistants.sort_order")}
                            >
                                <Option value="desc">{t("admin.assistants.sort_desc")}</Option>
                                <Option value="asc">{t("admin.assistants.sort_asc")}</Option>
                            </Dropdown>
                        </div>
                        {hasFilters && (
                            <Button appearance="subtle" icon={<ArrowResetRegular />} onClick={clearFilters}>
                                {t("admin.assistants.clear_filters")}
                            </Button>
                        )}
                    </section>

                    {error && (
                        <MessageBar intent="error" className={styles.message}>
                            <MessageBarBody>{error}</MessageBarBody>
                        </MessageBar>
                    )}
                    {isLoading ? (
                        <LoadingState label={t("common.loading")} />
                    ) : assistants.length === 0 ? (
                        <section className={styles.emptyState}>
                            <Body1>{t("admin.assistants.empty")}</Body1>
                            {hasFilters && <Button onClick={clearFilters}>{t("admin.assistants.clear_filters")}</Button>}
                        </section>
                    ) : (
                        <>
                            <section className={styles.list} aria-label={t("admin.assistants.results")}>
                                {assistantGroups.map(group =>
                                    group.assistants.length > 0 ? (
                                        <section
                                            key={group.accessType}
                                            className={styles.assistantGroup}
                                            aria-labelledby={`admin-assistant-group-${group.accessType}`}
                                        >
                                            <Title3 as="h2" id={`admin-assistant-group-${group.accessType}`} className={styles.groupTitle}>
                                                {group.label}
                                            </Title3>
                                            {group.assistants.map(assistant => {
                                                const version = assistant.latest_version;
                                                const lifecycle = stateBadge(version.state, t);
                                                const compliance = complianceBadge(version.compliance_check_result?.overall_status, t);
                                                return (
                                                    <Card
                                                        key={assistant.id}
                                                        appearance="outline"
                                                        className={styles.card}
                                                        data-selected={selectedAssistant?.id === assistant.id || undefined}
                                                    >
                                                        <div className={styles.cardHeader}>
                                                            <div>
                                                                <h3 className={styles.name}>
                                                                    <button
                                                                        type="button"
                                                                        className={styles.cardTitleButton}
                                                                        onClick={() => openDetails(assistant)}
                                                                        aria-expanded={selectedAssistant?.id === assistant.id && isDetailsOpen}
                                                                        aria-controls="assistant-details-drawer"
                                                                    >
                                                                        {version.name}
                                                                    </button>
                                                                </h3>
                                                                <Body2 className={styles.description}>
                                                                    {version.description || t("admin.assistants.no_description")}
                                                                </Body2>
                                                            </div>
                                                            <div className={styles.badges}>
                                                                <Badge appearance="tint" color={lifecycle.color}>
                                                                    {lifecycle.label}
                                                                </Badge>
                                                                <Badge appearance="tint" color={compliance.color}>
                                                                    {compliance.label}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className={styles.metadata}>
                                                            <span>{accessLabel(assistant, t)}</span>
                                                            <span>{t("admin.assistants.version", { version: version.version })}</span>
                                                            <span>
                                                                {t("admin.assistants.updated", { date: dateFormatter.format(new Date(assistant.updated_at)) })}
                                                            </span>
                                                            <span className={styles.subscribers}>
                                                                <PeopleRegular aria-hidden="true" />{" "}
                                                                {t("admin.assistants.subscribers", { count: assistant.subscriptions_count })}
                                                            </span>
                                                            <OwnerMetadataLink
                                                                owner={getPrimaryOwnerDetails(assistant)}
                                                                fallbackLabel={t("admin.assistants.unknown_owner")}
                                                            />
                                                        </div>
                                                        {(assistant.hierarchical_access || []).length > 0 && (
                                                            <div className={styles.hierarchy}>
                                                                <strong>{t("admin.assistants.hierarchy")}</strong>
                                                                <span>{assistant.hierarchical_access?.join(", ")}</span>
                                                            </div>
                                                        )}
                                                        {version.state === "pending_legal_review" && (
                                                            <Button
                                                                appearance="subtle"
                                                                className={styles.reviewLink}
                                                                onClick={() => navigate("/admin/legal-review")}
                                                            >
                                                                {t("admin.assistants.open_legal_review")}
                                                            </Button>
                                                        )}
                                                    </Card>
                                                );
                                            })}
                                        </section>
                                    ) : null
                                )}
                            </section>
                            {hasMore && (
                                <div className={styles.loadMore}>
                                    <Button appearance="secondary" onClick={() => void loadMore()} disabled={isLoadingMore}>
                                        {isLoadingMore ? t("common.loading") : t("admin.assistants.load_more")}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            <div className={styles.detailsSidebarSlot} data-open={isDetailsOpen} onTransitionEnd={handleDetailsSlotTransitionEnd}>
                <AssistantDetailsSidebar
                    isOpen={isDetailsOpen}
                    onClose={closeDetails}
                    assistant={selectedAssistant}
                    ownedAssistantIds={NO_OWNED_ASSISTANTS}
                    hideStartChat
                />
            </div>
        </div>
    );
};

const LoadingState = ({ label }: { label: string }) => (
    <div className={styles.centered}>
        <Spinner label={label} />
    </div>
);

export default AdminAssistants;
