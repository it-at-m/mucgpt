// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { type ToolInfo, type ToolListResponse } from "../../api/models";
import { ToolsSelectorContent } from "./ToolsSelector";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const tools: ToolListResponse = {
    tools: [
        { id: "lookup", name: "Lookup", description: "", mcp_group: "Knowledge base" },
        { id: "export", name: "Export", description: "", mcp_group: "Knowledge base" },
        { id: "brainstorm", name: "Brainstorm", description: "" }
    ]
};

const Harness = ({ initialSelection }: { initialSelection: ToolInfo[] }) => {
    const [selectedTools, setSelectedTools] = useState(initialSelection);

    return (
        <>
            <ToolsSelectorContent tools={tools} selectedTools={selectedTools} onSelectionChange={setSelectedTools} showActions={false} />
            <output data-testid="selected-tools">{selectedTools.map(tool => tool.id).join(",")}</output>
        </>
    );
};

describe("ToolsSelectorContent", () => {
    it("selects every group member while retaining selections from other entries", async () => {
        const user = userEvent.setup();
        render(<Harness initialSelection={[tools.tools[2]]} />);

        await user.click(screen.getByRole("checkbox", { name: "Knowledge base" }));

        expect(screen.getByTestId("selected-tools")).toHaveTextContent("lookup,export,brainstorm");
    });

    it("removes every group member while retaining selections from other entries", async () => {
        const user = userEvent.setup();
        render(<Harness initialSelection={tools.tools} />);

        await user.click(screen.getByRole("checkbox", { name: "Knowledge base" }));

        expect(screen.getByTestId("selected-tools")).toHaveTextContent("brainstorm");
    });
});
