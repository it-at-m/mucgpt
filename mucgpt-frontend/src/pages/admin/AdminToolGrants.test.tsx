// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../i18n";

const { getAdminTools, getAssistantToolGrantsApi, grantAssistantToolApi, showError, showSuccess } = vi.hoisted(() => ({
    getAdminTools: vi.fn(),
    getAssistantToolGrantsApi: vi.fn(),
    grantAssistantToolApi: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn()
}));

vi.mock("../../api/core-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/core-client")>()),
    getAdminTools
}));

vi.mock("../../api/assistant-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/assistant-client")>()),
    getAssistantToolGrantsApi,
    grantAssistantToolApi
}));

vi.mock("../../components/GlobalToastHandler/GlobalToastContext", () => ({
    useGlobalToastContext: () => ({ showError, showSuccess })
}));

import { AdminToolGrants } from "./AdminToolGrants";

describe("AdminToolGrants", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("selects a restricted tool and grants it to the assistant", async () => {
        getAdminTools.mockResolvedValue({
            tools: [
                {
                    id: "document-source/read_confidential_document",
                    name: "Read confidential documents",
                    description: "Read approved confidential documents.",
                    access: "restricted"
                }
            ]
        });
        getAssistantToolGrantsApi.mockResolvedValue([]);
        grantAssistantToolApi.mockResolvedValue({
            tool_id: "document-source/read_confidential_document",
            granted_by: "admin-123",
            granted_at: "2026-10-28T12:00:00Z"
        });
        const user = userEvent.setup();

        render(<AdminToolGrants assistantId="assistant-123" showHeading={false} />);

        const toolSelector = await screen.findByRole("combobox", { name: "Eingeschränktes Tool" });
        await user.click(toolSelector);
        await user.click(await screen.findByRole("option", { name: "Read confidential documents" }));
        await user.click(screen.getByRole("button", { name: "Tool freigeben" }));

        await waitFor(() => {
            expect(grantAssistantToolApi).toHaveBeenCalledWith("assistant-123", "document-source/read_confidential_document", {});
        });
        expect(showSuccess).toHaveBeenCalledWith("Tool wurde freigegeben.");
    });
});
