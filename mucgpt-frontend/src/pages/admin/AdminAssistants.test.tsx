// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../i18n";
import { UserContext } from "../layout/UserContextProvider";

const { getAdminAssistantsApi, getAdminTools } = vi.hoisted(() => ({
    getAdminAssistantsApi: vi.fn(),
    getAdminTools: vi.fn()
}));

vi.mock("../../api/assistant-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/assistant-client")>()),
    getAdminAssistantsApi
}));

vi.mock("../../api/core-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/core-client")>()),
    getAdminTools
}));

vi.mock("../../components/AssistantDetailsSidebar/AssistantDetailsSidebar", () => ({
    AssistantDetailsSidebar: () => null
}));

import AdminAssistants from "./AdminAssistants";

describe("AdminAssistants", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("filters assistants by the selected restricted tool grant", async () => {
        getAdminAssistantsApi.mockResolvedValue([]);
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
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <UserContext.Provider value={{ user: null, isAdmin: true, isLoading: false, error: null }}>
                    <AdminAssistants />
                </UserContext.Provider>
            </MemoryRouter>
        );

        const toolGrantFilter = await screen.findByRole("combobox", { name: "Eingeschränktes Tool" });
        await user.click(toolGrantFilter);
        await user.click(await screen.findByRole("option", { name: "Read confidential documents" }));

        await waitFor(() => {
            expect(getAdminAssistantsApi).toHaveBeenLastCalledWith(
                expect.objectContaining({ tool_grant: "document-source/read_confidential_document" }),
                expect.any(Object)
            );
        });
    });
});
