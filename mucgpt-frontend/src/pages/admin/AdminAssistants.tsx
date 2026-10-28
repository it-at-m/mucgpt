import { type TransitionEvent, useContext, useDeferredValue, useEffect, useRef, useState } from "react";
import {
    Badge,
    Avatar,
    Body1,
    Body2,
    Button,
    Card,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Field,
    Input,
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
import {
    ArrowResetRegular,
    ArrowSyncRegular,
    DismissRegular,
    Eye24Regular,
    EyeOff24Regular,
    People24Regular,
    PeopleRegular,
    WrenchRegular
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
    type AdminAssistantListQueryParams,
    type AssistantAccessType,
    type ComplianceStatus,
    getAdminAssistantsApi,
    getAssistantAuditEventsApi,
    updateAssistantAdminTagsApi,
    updateAssistantOwnersApi
} from "../../api/assistant-client";
import { type AdminTag, type AssistantAuditEvent, type AssistantResponse, type AssistantState, type OwnerDetailsResponse } from "../../api/models";
import { ApiError } from "../../api/fetch-utils";
import { AssistantDetailsSidebar, type AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { getPrimaryOwnerDetails, OwnerMetadataLink } from "../../components/OwnerMetadataLink/OwnerMetadataLink";
import DepartmentTreeDropdown from "../../components/DepartmentTreeDropdown/DepartmentTreeDropdown";
import { UserContext } from "../layout/UserContextProvider";
import { AdminToolGrants } from "./AdminToolGrants";
import styles from "./AdminAssistants.module.css";

const PAGE_SIZE = 50;
const AUDIT_EVENTS_PAGE_SIZE = 100;
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
    const [updatingAssistantId, setUpdatingAssistantId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const [ownersAssistant, setOwnersAssistant] = useState<AssistantResponse | null>(null);
    const [toolGrantsAssistant, setToolGrantsAssistant] = useState<AssistantResponse | null>(null);
    const [ownerInput, setOwnerInput] = useState("");
    const [ownerIds, setOwnerIds] = useState<string[]>([]);
    const [isSavingOwners, setIsSavingOwners] = useState(false);
    const [ownerUpdateError, setOwnerUpdateError] = useState<string | null>(null);
    const [auditEvents, setAuditEvents] = useState<AssistantAuditEvent[]>([]);
    const [hasMoreAuditEvents, setHasMoreAuditEvents] = useState(false);
    const [isLoadingMoreAuditEvents, setIsLoadingMoreAuditEvents] = useState(false);
    const requestVersion = useRef(0);
    const auditRequestVersion = useRef(0);
    const auditRequestController = useRef<AbortController | null>(null);

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

    const loadAuditEvents = (assistantId: string, offset = 0) => {
        auditRequestController.current?.abort();
        const controller = new AbortController();
        const currentRequestVersion = ++auditRequestVersion.current;
        auditRequestController.current = controller;
        setIsLoadingMoreAuditEvents(offset > 0);

        void getAssistantAuditEventsApi(assistantId, { offset, limit: AUDIT_EVENTS_PAGE_SIZE }, { signal: controller.signal })
            .then(events => {
                if (auditRequestVersion.current !== currentRequestVersion) return;
                setAuditEvents(current => (offset === 0 ? events : [...current, ...events]));
                setHasMoreAuditEvents(events.length === AUDIT_EVENTS_PAGE_SIZE);
            })
            .catch(() => {
                if (controller.signal.aborted || auditRequestVersion.current !== currentRequestVersion) return;
                if (offset === 0) setAuditEvents([]);
                setHasMoreAuditEvents(false);
            })
            .finally(() => {
                if (auditRequestVersion.current === currentRequestVersion) setIsLoadingMoreAuditEvents(false);
            });
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
        setAuditEvents([]);
        setHasMoreAuditEvents(false);
        loadAuditEvents(assistant.id);
    };

    const toggleFeatured = async (assistant: AssistantResponse) => {
        const adminTags: AdminTag[] = assistant.admin_tags.includes("featured") ? [] : ["featured"];
        setUpdatingAssistantId(assistant.id);
        setError(null);
        try {
            const updated = await updateAssistantAdminTagsApi(assistant.id, { admin_tags: adminTags });
            setSelectedAssistant(current => (current?.id === updated.id ? { ...current, rawData: updated } : current));
            setAssistants([]);
            setHasMore(false);
            setRefreshKey(current => current + 1);
        } catch (updateError) {
            setError(
                updateError instanceof Error ? updateError.message : t("admin.assistants.featured_update_failed", "The Featured tag could not be updated.")
            );
        } finally {
            setUpdatingAssistantId(null);
        }
    };

    const openOwnerDialog = (assistant: AssistantResponse) => {
        setOwnersAssistant(assistant);
        setOwnerIds(assistant.owner_ids || []);
        setOwnerInput("");
        setOwnerUpdateError(null);
    };

    const addOwner = () => {
        const ownerId = ownerInput.trim();
        if (!ownerId || ownerIds.includes(ownerId)) return;
        setOwnerIds(current => [...current, ownerId]);
        setOwnerInput("");
    };

    const removeOwner = (ownerId: string) => {
        setOwnerIds(current => current.filter(id => id !== ownerId));
    };

    const saveOwners = async () => {
        if (!ownersAssistant || ownerIds.length === 0) return;
        setIsSavingOwners(true);
        setOwnerUpdateError(null);
        try {
            const updated = await updateAssistantOwnersApi(ownersAssistant.id, { owner_ids: ownerIds });
            setAssistants(current => current.map(item => (item.id === updated.id ? updated : item)));
            setSelectedAssistant(current => (current?.id === updated.id ? { ...current, rawData: updated } : current));
            setOwnersAssistant(null);
            if (selectedAssistant?.id === updated.id) loadAuditEvents(updated.id);
        } catch (updateError) {
            setOwnerUpdateError(
                updateError instanceof Error ? updateError.message : t("admin.assistants.owners_update_failed", "The owners could not be updated.")
            );
        } finally {
            setIsSavingOwners(false);
        }
    };

    const closeDetails = () => {
        auditRequestController.current?.abort();
        auditRequestVersion.current += 1;
        setIsDetailsOpen(false);
    };

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
    const selectedStateLabel =
        state === "active"
            ? t("admin.assistants.state_active")
            : state === "pending_legal_review"
              ? t("admin.assistants.state_pending")
              : state === "inactive"
                ? t("admin.assistants.state_inactive")
                : t("admin.assistants.all_states");
    const selectedComplianceLabel =
        complianceStatus === "passed"
            ? t("admin.assistants.compliance_passed")
            : complianceStatus === "high_risk_detected"
              ? t("admin.assistants.compliance_high_risk")
              : complianceStatus === "error"
                ? t("admin.assistants.compliance_error")
                : t("admin.assistants.all_compliance");
    const selectedSortByLabel =
        sortBy === "title"
            ? t("admin.assistants.sort_title")
            : sortBy === "subscriptions"
              ? t("admin.assistants.sort_subscriptions")
              : t("admin.assistants.sort_updated");
    const selectedSortOrderLabel = sortOrder === "asc" ? t("admin.assistants.sort_asc") : t("admin.assistants.sort_desc");

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
                        <section className={styles.filterGroup} aria-labelledby="assistant-filter-heading">
                            <Title3 id="assistant-filter-heading">{t("admin.assistants.filters")}</Title3>
                            <SearchBox
                                className={styles.search}
                                value={search}
                                onChange={(_, data) => setSearch(data.value)}
                                placeholder={t("admin.assistants.search_placeholder")}
                                aria-label={t("admin.assistants.search_placeholder")}
                            />
                            <Dropdown
                                value={selectedStateLabel}
                                selectedOptions={[state ?? ""]}
                                button={{ children: selectedStateLabel }}
                                onOptionSelect={(_, data) => setState((data.optionValue as AssistantState) || undefined)}
                                placeholder={t("admin.assistants.all_states")}
                                aria-label={t("admin.assistants.all_states")}
                            >
                                <Option value="" text={t("admin.assistants.all_states")}>
                                    {t("admin.assistants.all_states")}
                                </Option>
                                <Option value="active" text={t("admin.assistants.state_active")}>
                                    {t("admin.assistants.state_active")}
                                </Option>
                                <Option value="pending_legal_review" text={t("admin.assistants.state_pending")}>
                                    {t("admin.assistants.state_pending")}
                                </Option>
                                <Option value="inactive" text={t("admin.assistants.state_inactive")}>
                                    {t("admin.assistants.state_inactive")}
                                </Option>
                            </Dropdown>
                            <Dropdown
                                value={selectedComplianceLabel}
                                selectedOptions={[complianceStatus ?? ""]}
                                button={{ children: selectedComplianceLabel }}
                                onOptionSelect={(_, data) => setComplianceStatus((data.optionValue as ComplianceStatus) || undefined)}
                                placeholder={t("admin.assistants.all_compliance")}
                                aria-label={t("admin.assistants.all_compliance")}
                            >
                                <Option value="" text={t("admin.assistants.all_compliance")}>
                                    {t("admin.assistants.all_compliance")}
                                </Option>
                                <Option value="passed" text={t("admin.assistants.compliance_passed")}>
                                    {t("admin.assistants.compliance_passed")}
                                </Option>
                                <Option value="high_risk_detected" text={t("admin.assistants.compliance_high_risk")}>
                                    {t("admin.assistants.compliance_high_risk")}
                                </Option>
                                <Option value="error" text={t("admin.assistants.compliance_error")}>
                                    {t("admin.assistants.compliance_error")}
                                </Option>
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
                            {access === "hierarchical" && (
                                <Field className={styles.departmentPicker} label={t("admin.assistants.department_label")}>
                                    <DepartmentTreeDropdown publishDepartments={departments} setPublishDepartments={setDepartments} multiple={false} />
                                </Field>
                            )}
                        </section>
                        <section className={styles.orderingGroup} aria-label={t("admin.assistants.sort_by")}>
                            <Body2 className={styles.orderingLabel}>{t("admin.assistants.sort_by")}</Body2>
                            <Dropdown
                                value={selectedSortByLabel}
                                selectedOptions={[sortBy]}
                                button={{ children: selectedSortByLabel }}
                                onOptionSelect={(_, data) => setSortBy(data.optionValue as typeof sortBy)}
                                aria-label={t("admin.assistants.sort_by")}
                            >
                                <Option value="updated" text={t("admin.assistants.sort_updated")}>
                                    {t("admin.assistants.sort_updated")}
                                </Option>
                                <Option value="title" text={t("admin.assistants.sort_title")}>
                                    {t("admin.assistants.sort_title")}
                                </Option>
                                <Option value="subscriptions" text={t("admin.assistants.sort_subscriptions")}>
                                    {t("admin.assistants.sort_subscriptions")}
                                </Option>
                            </Dropdown>
                            <Dropdown
                                value={selectedSortOrderLabel}
                                selectedOptions={[sortOrder]}
                                button={{ children: selectedSortOrderLabel }}
                                onOptionSelect={(_, data) => setSortOrder(data.optionValue as typeof sortOrder)}
                                aria-label={t("admin.assistants.sort_order")}
                            >
                                <Option value="desc" text={t("admin.assistants.sort_desc")}>
                                    {t("admin.assistants.sort_desc")}
                                </Option>
                                <Option value="asc" text={t("admin.assistants.sort_asc")}>
                                    {t("admin.assistants.sort_asc")}
                                </Option>
                            </Dropdown>
                            {hasFilters && (
                                <Button appearance="subtle" icon={<ArrowResetRegular />} onClick={clearFilters}>
                                    {t("admin.assistants.clear_filters")}
                                </Button>
                            )}
                        </section>
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
                                                            <div className={styles.cardCopy}>
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
                                                                {assistant.admin_tags.includes("featured") && (
                                                                    <Badge className={styles.badge} appearance="tint" color="brand">
                                                                        {t("admin.assistants.featured", "Featured")}
                                                                    </Badge>
                                                                )}
                                                                <Badge className={styles.badge} appearance="tint" color={lifecycle.color}>
                                                                    {lifecycle.label}
                                                                </Badge>
                                                                <Badge className={styles.badge} appearance="tint" color={compliance.color}>
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
                                                        <Button
                                                            appearance="secondary"
                                                            onClick={() => void toggleFeatured(assistant)}
                                                            disabled={updatingAssistantId === assistant.id}
                                                        >
                                                            {updatingAssistantId === assistant.id
                                                                ? t("common.loading")
                                                                : assistant.admin_tags.includes("featured")
                                                                  ? t("admin.assistants.remove_featured", "Remove Featured")
                                                                  : t("admin.assistants.mark_featured", "Mark as Featured")}
                                                        </Button>
                                                        <Button appearance="secondary" icon={<PeopleRegular />} onClick={() => openOwnerDialog(assistant)}>
                                                            {t("admin.assistants.manage_owners", "Manage owners")}
                                                        </Button>
                                                        <Button
                                                            appearance="secondary"
                                                            icon={<WrenchRegular />}
                                                            onClick={() => setToolGrantsAssistant(assistant)}
                                                        >
                                                            {t("admin.assistants.manage_restricted_tools")}
                                                        </Button>
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
                    auditEvents={auditEvents}
                    hasMoreAuditEvents={hasMoreAuditEvents}
                    isLoadingMoreAuditEvents={isLoadingMoreAuditEvents}
                    onLoadMoreAuditEvents={() => selectedAssistant && loadAuditEvents(selectedAssistant.id, auditEvents.length)}
                />
            </div>
            <Dialog open={ownersAssistant !== null} onOpenChange={(_, data) => !data.open && setOwnersAssistant(null)}>
                <DialogSurface className={styles.ownerDialogSurface}>
                    <DialogBody>
                        <DialogTitle>{t("admin.assistants.manage_owners", "Manage owners")}</DialogTitle>
                        <DialogContent className={styles.ownerDialogContent}>
                            <Body2>{t("admin.assistants.owner_hint", "Add or remove owner user IDs. At least one owner is required.")}</Body2>
                            <section className={styles.ownerSection} aria-labelledby="owner-list-title">
                                <div className={styles.ownerSectionHeader}>
                                    <div className={styles.ownerSectionCopy}>
                                        <Title3 id="owner-list-title">{t("community_assistants.owner_details", "Owners")}</Title3>
                                    </div>
                                    <Badge appearance="tint">{ownerIds.length}</Badge>
                                </div>
                                <div className={styles.ownerList} role="list">
                                    {ownerIds.map(ownerId => {
                                        const details = ownersAssistant?.owners_detailed?.find(owner => owner.user_id === ownerId);
                                        return (
                                            <OwnerEditorRow
                                                key={ownerId}
                                                ownerId={ownerId}
                                                details={details}
                                                onRemove={() => removeOwner(ownerId)}
                                                removeLabel={`${t("admin.assistants.remove_owner", "Remove")}: ${
                                                    [details?.givenName, details?.sn].filter(Boolean).join(" ") || details?.username || ownerId
                                                }`}
                                                directoryUnavailableLabel={t("admin.assistants.owner_directory_unavailable", "LDAP details unavailable")}
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                            <Field
                                label={t("admin.assistants.owner_id", "Owner user ID")}
                                hint={t("admin.assistants.owner_id_hint", "Enter a user ID and add it to the owner list.")}
                            >
                                <div className={styles.ownerInputRow}>
                                    <Input
                                        value={ownerInput}
                                        onChange={(_, data) => setOwnerInput(data.value)}
                                        onKeyDown={event => event.key === "Enter" && (event.preventDefault(), addOwner())}
                                    />
                                    <Button appearance="secondary" onClick={addOwner} disabled={!ownerInput.trim() || ownerIds.includes(ownerInput.trim())}>
                                        {t("admin.assistants.add_owner", "Add")}
                                    </Button>
                                </div>
                            </Field>
                            {ownerIds.length === 0 && (
                                <Body2 className={styles.ownerValidation}>{t("admin.assistants.owner_required", "At least one owner is required.")}</Body2>
                            )}
                            {ownerUpdateError && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{ownerUpdateError}</MessageBarBody>
                                </MessageBar>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setOwnersAssistant(null)}>
                                {t("common.cancel", "Cancel")}
                            </Button>
                            <Button appearance="primary" onClick={() => void saveOwners()} disabled={ownerIds.length === 0 || isSavingOwners}>
                                {isSavingOwners ? t("common.loading") : t("common.save", "Save")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <Dialog open={toolGrantsAssistant !== null} onOpenChange={(_, data) => !data.open && setToolGrantsAssistant(null)}>
                <DialogSurface className={styles.ownerDialogSurface}>
                    <DialogBody>
                        <DialogTitle>{t("admin.assistants.tool_grants_title")}</DialogTitle>
                        <DialogContent className={styles.ownerDialogContent}>
                            <Body2>{t("admin.assistants.tool_grants_description")}</Body2>
                            {toolGrantsAssistant && <AdminToolGrants assistantId={toolGrantsAssistant.id} showHeading={false} />}
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setToolGrantsAssistant(null)}>
                                {t("common.close", "Close")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};

const OwnerEditorRow = ({
    ownerId,
    details,
    onRemove,
    removeLabel,
    directoryUnavailableLabel
}: {
    ownerId: string;
    details?: OwnerDetailsResponse;
    onRemove: () => void;
    removeLabel: string;
    directoryUnavailableLabel: string;
}) => {
    const displayName = [details?.givenName, details?.sn].filter(Boolean).join(" ") || details?.username || ownerId;
    const directoryMetadata = [details?.mail, details?.organizationalunit].filter(Boolean).join(" · ");

    return (
        <div className={styles.ownerRow} role="listitem">
            <Avatar name={displayName} color="brand" size={40} />
            <div className={styles.ownerIdentity}>
                <Body1 className={styles.ownerName}>{displayName}</Body1>
                <Body2 className={styles.ownerMetadata}>{directoryMetadata || directoryUnavailableLabel}</Body2>
                {details && displayName !== ownerId && <Body2 className={styles.ownerId}>{ownerId}</Body2>}
            </div>
            <Button appearance="subtle" icon={<DismissRegular />} onClick={onRemove} aria-label={removeLabel} title={removeLabel}></Button>
        </div>
    );
};

const LoadingState = ({ label }: { label: string }) => (
    <div className={styles.centered}>
        <Spinner label={label} />
    </div>
);

export default AdminAssistants;
