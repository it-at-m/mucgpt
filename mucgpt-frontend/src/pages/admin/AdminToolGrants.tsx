import { useEffect, useMemo, useState } from "react";
import { Body2, Button, Dropdown, Field, MessageBar, MessageBarBody, Option, Spinner, Textarea, Title3 } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

import { getAdminTools } from "../../api/core-client";
import { getAssistantToolGrantsApi, grantAssistantToolApi, revokeAssistantToolApi } from "../../api/assistant-client";
import { type AssistantToolGrant, type ToolInfo } from "../../api/models";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import styles from "./AdminToolGrants.module.css";

interface AdminToolGrantsProps {
    assistantId: string;
}

export const AdminToolGrants = ({ assistantId }: AdminToolGrantsProps) => {
    const { t, i18n } = useTranslation();
    const { showError, showSuccess } = useGlobalToastContext();
    const [catalog, setCatalog] = useState<ToolInfo[]>([]);
    const [grants, setGrants] = useState<AssistantToolGrant[]>([]);
    const [selectedToolId, setSelectedToolId] = useState("");
    const [reason, setReason] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [revokingToolId, setRevokingToolId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        setSelectedToolId("");
        setReason("");

        void Promise.all([getAdminTools(i18n.language), getAssistantToolGrantsApi(assistantId, { signal: controller.signal })])
            .then(([toolsResponse, grantResponse]) => {
                if (controller.signal.aborted) return;
                setCatalog(toolsResponse.tools.filter(tool => tool.access === "restricted"));
                setGrants(grantResponse);
            })
            .catch(loadError => {
                if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : t("admin.assistants.tool_grants_load_failed"));
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [assistantId, i18n.language, t]);

    const availableTools = useMemo(() => {
        const grantedToolIds = new Set(grants.map(grant => grant.tool_id));
        return catalog.filter(tool => !grantedToolIds.has(tool.id));
    }, [catalog, grants]);
    const metadataById = useMemo(() => new Map(catalog.map(tool => [tool.id, tool])), [catalog]);
    const selectedTool = availableTools.find(tool => tool.id === selectedToolId);
    const dateFormatter = useMemo(
        () => new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { dateStyle: "medium", timeStyle: "short" }),
        [i18n.language, i18n.resolvedLanguage]
    );

    const grantTool = async () => {
        if (!selectedTool) return;
        setIsSaving(true);
        setError(null);
        try {
            const grant = await grantAssistantToolApi(assistantId, selectedTool.id, reason.trim() ? { reason: reason.trim() } : {});
            setGrants(current => [...current, grant]);
            setSelectedToolId("");
            setReason("");
            showSuccess(t("admin.assistants.tool_granted"));
        } catch (grantError) {
            const message = grantError instanceof Error ? grantError.message : t("admin.assistants.tool_grant_failed");
            setError(message);
            showError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const revokeTool = async (toolId: string) => {
        setRevokingToolId(toolId);
        setError(null);
        try {
            await revokeAssistantToolApi(assistantId, toolId);
            setGrants(current => current.filter(grant => grant.tool_id !== toolId));
            showSuccess(t("admin.assistants.tool_revoked"));
        } catch (revokeError) {
            const message = revokeError instanceof Error ? revokeError.message : t("admin.assistants.tool_revoke_failed");
            setError(message);
            showError(message);
        } finally {
            setRevokingToolId(null);
        }
    };

    return (
        <section className={styles.section} aria-labelledby="admin-tool-grants-title">
            <div>
                <Title3 as="h3" id="admin-tool-grants-title">
                    {t("admin.assistants.tool_grants_title")}
                </Title3>
                <Body2>{t("admin.assistants.tool_grants_description")}</Body2>
            </div>
            {error && (
                <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {isLoading ? (
                <Spinner size="small" label={t("common.loading")} />
            ) : (
                <>
                    {grants.length > 0 ? (
                        <ul className={styles.grantList} aria-label={t("admin.assistants.active_tool_grants")}>
                            {grants.map(grant => {
                                const tool = metadataById.get(grant.tool_id);
                                return (
                                    <li key={grant.tool_id} className={styles.grantItem}>
                                        <div className={styles.grantCopy}>
                                            <strong>{tool?.name || grant.tool_id}</strong>
                                            {tool?.description && <Body2>{tool.description}</Body2>}
                                            <Body2 className={styles.metadata}>
                                                {t("admin.assistants.tool_granted_at", { date: dateFormatter.format(new Date(grant.granted_at)) })}
                                            </Body2>
                                            {grant.reason && <Body2>{grant.reason}</Body2>}
                                        </div>
                                        <Button
                                            appearance="secondary"
                                            size="small"
                                            disabled={revokingToolId === grant.tool_id}
                                            onClick={() => void revokeTool(grant.tool_id)}
                                        >
                                            {revokingToolId === grant.tool_id ? t("common.loading") : t("admin.assistants.revoke_tool")}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Body2>{t("admin.assistants.no_tool_grants")}</Body2>
                    )}
                    {availableTools.length > 0 && (
                        <div className={styles.grantForm}>
                            <Field label={t("admin.assistants.restricted_tool_label")}>
                                <Dropdown
                                    placeholder={t("admin.assistants.restricted_tool_placeholder")}
                                    selectedOptions={selectedToolId ? [selectedToolId] : []}
                                    value={selectedTool?.name || ""}
                                    onOptionSelect={(_event, data) => setSelectedToolId(data.optionValue || "")}
                                >
                                    {availableTools.map(tool => (
                                        <Option key={tool.id} value={tool.id} text={tool.name}>
                                            {tool.name}
                                        </Option>
                                    ))}
                                </Dropdown>
                            </Field>
                            <Field label={t("admin.assistants.tool_grant_reason_label")} hint={t("admin.assistants.tool_grant_reason_hint")}>
                                <Textarea value={reason} onChange={(_event, data) => setReason(data.value)} resize="vertical" />
                            </Field>
                            <Button appearance="primary" disabled={!selectedTool || isSaving} onClick={() => void grantTool()}>
                                {isSaving ? t("common.loading") : t("admin.assistants.grant_tool")}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};
