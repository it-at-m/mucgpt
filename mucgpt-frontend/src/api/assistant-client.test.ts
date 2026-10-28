// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdminAssistantsApi } from "./assistant-client";

describe("getAdminAssistantsApi", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("includes the selected restricted tool grant in the query", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await getAdminAssistantsApi({ tool_grant: "document-source/read_confidential_document" });

        expect(fetchMock).toHaveBeenCalledWith("/api/admin/assistants?tool_grant=document-source%2Fread_confidential_document", expect.any(Object));
    });
});
