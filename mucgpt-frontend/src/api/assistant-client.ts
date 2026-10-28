import { deleteConfig, getConfig, handleApiRequest, patchConfig, postConfig, putConfig } from "./fetch-utils";
import {
    Assistant,
    AssistantCreateInput,
    AssistantCreateResponse,
    AssistantResponse,
    AssistantAuditEvent,
    AssistantState,
    AssistantStateUpdateInput,
    AdminOwnersUpdateInput,
    AdminTagsUpdateInput,
    AssistantUpdateInput,
    AssistantToolGrant,
    AssistantToolGrantUpdateInput,
    CommunityAssistant,
    DirectoryNode
} from "./models";

export type AssistantListSortBy = "title" | "updated" | "subscriptions";
export type AssistantListSortOrder = "asc" | "desc";

export interface AssistantListQueryParams {
    search?: string;
    sort_by?: AssistantListSortBy;
    sort_order?: AssistantListSortOrder;
    offset?: number;
    limit?: number;
    exclude_owned?: boolean;
    exclude_subscribed?: boolean;
    admin_tags?: string[];
    priority_admin_tags?: string[];
}

export type AssistantAccessType = "private" | "public" | "hierarchical";
export type ComplianceStatus = "passed" | "high_risk_detected" | "error";

export interface AdminAssistantListQueryParams {
    state?: AssistantState;
    compliance_status?: ComplianceStatus;
    access?: AssistantAccessType;
    department?: string;
    tool_grant?: string;
    search?: string;
    sort_by?: AssistantListSortBy;
    sort_order?: AssistantListSortOrder;
    offset?: number;
    limit?: number;
}

export interface AssistantAuditEventQueryParams {
    offset?: number;
    limit?: number;
}

interface AssistantRequestOptions {
    signal?: AbortSignal;
}

const buildQueryString = (params?: AssistantListQueryParams): string => {
    if (!params) return "";

    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.sort_order) query.set("sort_order", params.sort_order);
    if (typeof params.offset === "number") query.set("offset", String(params.offset));
    if (typeof params.limit === "number") query.set("limit", String(params.limit));
    if (params.exclude_owned) query.set("exclude_owned", "true");
    if (params.exclude_subscribed) query.set("exclude_subscribed", "true");
    params.admin_tags?.forEach(tag => query.append("admin_tags", tag));
    params.priority_admin_tags?.forEach(tag => query.append("priority_admin_tags", tag));

    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
};

const buildAdminQueryString = (params?: AdminAssistantListQueryParams): string => {
    if (!params) return "";

    const query = new URLSearchParams();
    if (params.state) query.set("state", params.state);
    if (params.compliance_status) query.set("compliance_status", params.compliance_status);
    if (params.access) query.set("access", params.access);
    if (params.department?.trim()) query.set("department", params.department.trim());
    if (params.tool_grant) query.set("tool_grant", params.tool_grant);
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.sort_order) query.set("sort_order", params.sort_order);
    if (typeof params.offset === "number") query.set("offset", String(params.offset));
    if (typeof params.limit === "number") query.set("limit", String(params.limit));

    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
};

/**
 * Get all assistants the user is subscribed to (ID and name only).
 * @returns Array of SubscriptionResponse
 */

export async function getUserSubscriptionsApi(params?: AssistantListQueryParams, options?: AssistantRequestOptions): Promise<CommunityAssistant[]> {
    return handleApiRequest(
        () => fetch(`/api/user/subscriptions${buildQueryString(params)}`, { ...getConfig(), signal: options?.signal }),
        "Failed to get user subscriptions"
    );
} /**
 * Unsubscribe the current user from an assistant.
 * @param assistantId The assistant's ID.
 * @returns StatusResponse
 */

export async function unsubscribeFromAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/user/subscriptions/${assistantId}`, deleteConfig()), "Failed to unsubscribe from assistant");
}
export async function subscribeToAssistantApi(assistantId: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/user/subscriptions/${assistantId}`, postConfig({})), "Failed to subscribe to assistant");
}
export async function getOwnedCommunityAssistants(params?: AssistantListQueryParams, options?: AssistantRequestOptions): Promise<AssistantResponse[]> {
    return handleApiRequest(
        () => fetch(`/api/user/assistants${buildQueryString(params)}`, { ...getConfig(), signal: options?.signal }),
        "Failed to get owned community assistants"
    );
}
export async function createCommunityAssistantApi(input: AssistantCreateInput): Promise<AssistantCreateResponse> {
    return handleApiRequest(() => fetch("/api/assistant/create", postConfig(input)), "Failed to create community assistant");
}

export async function duplicateCommunityAssistantApi(id: string): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/duplicate`, postConfig()), "Failed to duplicate community assistant");
}

export async function getAllCommunityAssistantsApi(params?: AssistantListQueryParams, options?: AssistantRequestOptions): Promise<AssistantResponse[]> {
    return handleApiRequest(
        () => fetch(`/api/assistant${buildQueryString(params)}`, { ...getConfig(), signal: options?.signal }),
        "Failed to get all community assistants"
    );
}

export async function getCommunityAssistantApi(id: string): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}`, getConfig()), "Failed to get community assistant");
}

export async function updateCommunityAssistantApi(id: string, input: AssistantUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/update`, postConfig(input)), "Failed to update community assistant");
}

export async function deleteCommunityAssistantApi(id: string): Promise<{ message: string }> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/delete`, postConfig({})), "Failed to delete community assistant");
}

export async function getCommunityAssistantVersionApi(id: string, version: string): Promise<Assistant> {
    return handleApiRequest(() => fetch(`/api/assistant/${id}/version/${version}`, getConfig()), "Failed to get community assistant version");
}

export async function getDirectoryChildren(path: string[] = []): Promise<DirectoryNode[]> {
    let url = "/api/directory/children";
    if (path.length > 0) {
        const jsonPath = JSON.stringify(path);
        url += `?path=${encodeURIComponent(jsonPath)}`;
    }
    return handleApiRequest(() => fetch(url, getConfig()), "Failed to get directory children");
}

export async function getAssistantReviewQueueApi(options?: AssistantRequestOptions): Promise<AssistantResponse[]> {
    return handleApiRequest(() => fetch("/api/admin/assistant/review", { ...getConfig(), signal: options?.signal }), "Failed to get assistant review queue");
}

export async function getAdminAssistantsApi(params?: AdminAssistantListQueryParams, options?: AssistantRequestOptions): Promise<AssistantResponse[]> {
    return handleApiRequest(
        () => fetch(`/api/admin/assistants${buildAdminQueryString(params)}`, { ...getConfig(), signal: options?.signal }),
        "Failed to get admin assistant list"
    );
}

export async function updateAssistantStateApi(assistantId: string, input: AssistantStateUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/admin/assistant/${assistantId}/state`, patchConfig({ ...input })), "Failed to update assistant state");
}

export async function updateAssistantAdminTagsApi(assistantId: string, input: AdminTagsUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/admin/assistant/${assistantId}/tags`, patchConfig({ ...input })), "Failed to update assistant tags");
}

export async function getAssistantToolGrantsApi(assistantId: string, options?: AssistantRequestOptions): Promise<AssistantToolGrant[]> {
    return handleApiRequest(
        () => fetch(`/api/admin/assistant/${encodeURIComponent(assistantId)}/tool-grants`, { ...getConfig(), signal: options?.signal }),
        "Failed to get assistant tool grants"
    );
}

export async function grantAssistantToolApi(assistantId: string, toolId: string, input: AssistantToolGrantUpdateInput): Promise<AssistantToolGrant> {
    return handleApiRequest(
        () => fetch(`/api/admin/assistant/${encodeURIComponent(assistantId)}/tool-grants/${encodeURIComponent(toolId)}`, putConfig({ ...input })),
        "Failed to grant assistant tool availability"
    );
}

export async function revokeAssistantToolApi(assistantId: string, toolId: string): Promise<void> {
    return handleApiRequest(
        () => fetch(`/api/admin/assistant/${encodeURIComponent(assistantId)}/tool-grants/${encodeURIComponent(toolId)}`, deleteConfig()),
        "Failed to revoke assistant tool availability"
    );
}

export async function updateAssistantOwnersApi(assistantId: string, input: AdminOwnersUpdateInput): Promise<AssistantResponse> {
    return handleApiRequest(() => fetch(`/api/admin/assistant/${assistantId}/owners`, patchConfig({ ...input })), "Failed to update assistant owners");
}

export async function getAssistantAuditEventsApi(
    assistantId: string,
    params?: AssistantAuditEventQueryParams,
    options?: AssistantRequestOptions
): Promise<AssistantAuditEvent[]> {
    const query = new URLSearchParams();
    if (typeof params?.offset === "number") query.set("offset", String(params.offset));
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    const queryString = query.size > 0 ? `?${query.toString()}` : "";

    return handleApiRequest(
        () => fetch(`/api/admin/assistant/${assistantId}/audit-events${queryString}`, { ...getConfig(), signal: options?.signal }),
        "Failed to get assistant audit events"
    );
}
