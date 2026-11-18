// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { type ToolListResponse } from "../../api/models";
import { ChatToolSelector } from "./ChatToolSelector";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const tools: ToolListResponse = {
    tools: [
        { id: "lookup", name: "Lookup", description: "", mcp_group: "Knowledge base" },
        { id: "export", name: "Export", description: "", mcp_group: "Knowledge base" },
        { id: "brainstorm", name: "Brainstorm", description: "" }
    ]
};

const Harness = ({ initialSelection }: { initialSelection: string[] }) => {
    const [selectedTools, setSelectedTools] = useState(initialSelection);

    return (
        <>
            <ChatToolSelector tools={tools} selectedTools={selectedTools} setSelectedTools={setSelectedTools} />
            <output data-testid="selected-tools">{selectedTools.join(",")}</output>
        </>
    );
};

describe("ChatToolSelector", () => {
    it("preserves a partial group selection when toggling an unrelated entry", async () => {
        const user = userEvent.setup();
        render(<Harness initialSelection={["lookup"]} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByRole("menuitemcheckbox", { name: "Brainstorm" }));

        expect(screen.getByTestId("selected-tools")).toHaveTextContent("lookup,brainstorm");
        expect(screen.getByTestId("selected-tools")).not.toHaveTextContent("export");
    });

    it("selects every member when a group is toggled", async () => {
        const user = userEvent.setup();
        render(<Harness initialSelection={["brainstorm"]} />);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByRole("menuitemcheckbox", { name: "Knowledge base" }));

        expect(screen.getByTestId("selected-tools")).toHaveTextContent("brainstorm,lookup,export");
    });
});
