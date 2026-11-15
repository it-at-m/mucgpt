// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createCommunityAssistantApi,
    deleteCommunityAssistantApi,
    duplicateCommunityAssistantApi,
    getAdminAssistantsApi,
    getAllCommunityAssistantsApi,
    getAssistantAuditEventsApi,
    getAssistantReviewQueueApi,
    getCommunityAssistantApi,
    getCommunityAssistantVersionApi,
    getDirectoryChildren,
    getOwnedCommunityAssistants,
    getUserSubscriptionsApi,
    subscribeToAssistantApi,
    unsubscribeFromAssistantApi,
    updateAssistantAdminTagsApi,
    updateAssistantOwnersApi,
    updateAssistantStateApi,
    updateCommunityAssistantApi
} from "./assistant-client";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-csrf; Path=/";
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

const lastCall = () => fetchMock.mock.calls.at(-1)!;

describe("query building", () => {
    it("requests the plain list endpoint without query params", async () => {
        await getAllCommunityAssistantsApi();
        expect(lastCall()[0]).toBe("/api/assistant");
    });

    it("maps all list filters into query parameters", async () => {
        await getAllCommunityAssistantsApi({
            search: "  excel  ",
            sort_by: "updated",
            sort_order: "desc",
            offset: 10,
            limit: 50,
            exclude_owned: true,
            exclude_subscribed: true,
            admin_tags: ["legal", "hr"],
            priority_admin_tags: ["urgent"]
        });

        const url = new URL(lastCall()[0] as string, "https://localhost");
        expect(url.pathname).toBe("/api/assistant");
        expect(url.searchParams.get("search")).toBe("excel");
        expect(url.searchParams.get("sort_by")).toBe("updated");
        expect(url.searchParams.get("sort_order")).toBe("desc");
        expect(url.searchParams.get("offset")).toBe("10");
        expect(url.searchParams.get("limit")).toBe("50");
        expect(url.searchParams.get("exclude_owned")).toBe("true");
        expect(url.searchParams.get("exclude_subscribed")).toBe("true");
        expect(url.searchParams.getAll("admin_tags")).toEqual(["legal", "hr"]);
        expect(url.searchParams.getAll("priority_admin_tags")).toEqual(["urgent"]);
    });

    it("omits blank search values instead of sending an empty filter", async () => {
        await getAllCommunityAssistantsApi({ search: "   ", exclude_owned: false, exclude_subscribed: false });
        expect(new URL(lastCall()[0] as string, "https://localhost").search).toBe("");
    });

    it("builds admin list queries with state, compliance, access and a trimmed department", async () => {
        await getAdminAssistantsApi({
            state: "inactive",
            compliance_status: "high_risk_detected",
            access: "hierarchical",
            department: "  IT  ",
            search: "excel",
            sort_by: "subscriptions",
            sort_order: "asc",
            offset: 5,
            limit: 20
        });

        const url = new URL(lastCall()[0] as string, "https://localhost");
        expect(url.pathname).toBe("/api/admin/assistants");
        expect(url.searchParams.get("state")).toBe("inactive");
        expect(url.searchParams.get("compliance_status")).toBe("high_risk_detected");
        expect(url.searchParams.get("access")).toBe("hierarchical");
        expect(url.searchParams.get("department")).toBe("IT");
        expect(url.searchParams.get("search")).toBe("excel");
        expect(url.searchParams.get("sort_by")).toBe("subscriptions");
        expect(url.searchParams.get("sort_order")).toBe("asc");
        expect(url.searchParams.get("offset")).toBe("5");
        expect(url.searchParams.get("limit")).toBe("20");
    });

    it("encodes the directory path for child lookups", async () => {
        await getDirectoryChildren(["Rathaus", "IT/Referat"]);
        expect(lastCall()[0]).toBe(`/api/directory/children?path=${encodeURIComponent(JSON.stringify(["Rathaus", "IT/Referat"]))}`);

        await getDirectoryChildren();
        expect(lastCall()[0]).toBe("/api/directory/children");
    });
});

describe("request shapes", () => {
    it("reads user subscriptions with GET and the signal option", async () => {
        const controller = new AbortController();
        await getUserSubscriptionsApi({ limit: 5 }, { signal: controller.signal });
        const [url, init] = lastCall();
        expect(url).toBe("/api/user/subscriptions?limit=5");
        expect(init?.method).toBeUndefined();
        expect(init?.signal).toBe(controller.signal);
    });

    it("unsubscribes with DELETE and subscribes with an empty POST", async () => {
        await unsubscribeFromAssistantApi("a-1");
        expect(lastCall()).toEqual([`/api/user/subscriptions/a-1`, expect.objectContaining({ method: "DELETE" })]);

        await subscribeToAssistantApi("a-1");
        const [url, init] = lastCall();
        expect(url).toBe("/api/user/subscriptions/a-1");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe("{}");
    });

    it("lists owned assistants with GET", async () => {
        await getOwnedCommunityAssistants({ sort_by: "title", sort_order: "asc" });
        const [url, init] = lastCall();
        expect(url).toBe("/api/user/assistants?sort_by=title&sort_order=asc");
        expect(init?.method).toBeUndefined();
    });

    it("creates an assistant via POST with a JSON body", async () => {
        const input = { name: "Neu", system_prompt: "Du bist hilfreich.", is_visible: false };
        await createCommunityAssistantApi(input as never);
        const [url, init] = lastCall();
        expect(url).toBe("/api/assistant/create");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual(input);
    });

    it("duplicates an assistant via POST without body", async () => {
        await duplicateCommunityAssistantApi("a-9");
        const [url, init] = lastCall();
        expect(url).toBe("/api/assistant/a-9/duplicate");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeUndefined();
    });

    it("reads, updates and deletes community assistants", async () => {
        await getCommunityAssistantApi("a-1");
        expect(lastCall()[0]).toBe("/api/assistant/a-1");

        await updateCommunityAssistantApi("a-1", { title: "Neu" } as never);
        expect(lastCall()[0]).toBe("/api/assistant/a-1/update");
        expect(lastCall()[1]?.method).toBe("POST");

        await deleteCommunityAssistantApi("a-1");
        expect(lastCall()[0]).toBe("/api/assistant/a-1/delete");
        expect(lastCall()[1]?.method).toBe("POST");

        await getCommunityAssistantVersionApi("a-1", "3");
        expect(lastCall()[0]).toBe("/api/assistant/a-1/version/3");
    });

    it("reads the review queue with GET and signal", async () => {
        const controller = new AbortController();
        await getAssistantReviewQueueApi({ signal: controller.signal });
        const [url, init] = lastCall();
        expect(url).toBe("/api/admin/assistant/review");
        expect(init?.signal).toBe(controller.signal);
    });

    it("patches admin state, tags and owners", async () => {
        await updateAssistantStateApi("a-1", { state: "active" } as never);
        const [stateUrl, stateInit] = lastCall();
        expect(stateUrl).toBe("/api/admin/assistant/a-1/state");
        expect(stateInit?.method).toBe("PATCH");
        expect(JSON.parse(String(stateInit?.body))).toEqual({ state: "active" });

        await updateAssistantAdminTagsApi("a-1", { admin_tags: ["legal"] } as never);
        expect(lastCall()[0]).toBe("/api/admin/assistant/a-1/tags");

        await updateAssistantOwnersApi("a-1", { owner_ids: ["u-1"] } as never);
        expect(lastCall()[0]).toBe("/api/admin/assistant/a-1/owners");
    });

    it("appends audit-event paging only when given", async () => {
        await getAssistantAuditEventsApi("a-1", { offset: 2, limit: 10 });
        expect(lastCall()[0]).toBe("/api/admin/assistant/a-1/audit-events?offset=2&limit=10");

        await getAssistantAuditEventsApi("a-1");
        expect(lastCall()[0]).toBe("/api/admin/assistant/a-1/audit-events");
    });

    it("propagates a request failure as an ApiError", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Fehlt" }), { status: 404 }));
        await expect(getCommunityAssistantApi("missing")).rejects.toMatchObject({ status: 404, message: "Fehlt" });
    });
});
