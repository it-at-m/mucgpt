// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToolApproval } from "./ToolApproval";
import type { ToolApprovalRequest } from "../../utils/toolApproval";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock("../../hooks/useToolDisplayName", () => ({
    useToolDisplayName: () => (toolId: string) => toolId
}));
vi.mock("../AnswerActivity/useToolIcon", () => ({
    useToolIcon: () => () => <span />
}));

const request = (id: string): ToolApprovalRequest => ({
    id,
    toolName: "web_search",
    args: { query: `Anfrage ${id}`, limit: 5 },
    dataClassification: "public"
});

describe("ToolApproval", () => {
    it("shows what would be sent", () => {
        render(<ToolApproval requests={[request("a")]} onSubmit={vi.fn()} />);

        expect(screen.getByText("chat.tool_approval_sent")).toBeInTheDocument();
        expect(screen.getByText("query")).toBeInTheDocument();
        expect(screen.getByText("Anfrage a")).toBeInTheDocument();
        expect(screen.getByText("limit")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not take focus, so Enter from the composer cannot approve", () => {
        const onSubmit = vi.fn();
        render(<ToolApproval requests={[request("a")]} onSubmit={onSubmit} />);

        expect(screen.getByRole("button", { name: "chat.tool_approval_approve_label" })).not.toHaveFocus();
    });

    it("answers a single request right away", async () => {
        const onSubmit = vi.fn();
        render(<ToolApproval requests={[request("a")]} onSubmit={onSubmit} />);

        await userEvent.click(screen.getByRole("button", { name: "chat.tool_approval_reject_label" }));

        expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ a: "reject" });
    });

    it("tells which data the tool is approved for", () => {
        render(<ToolApproval requests={[{ ...request("a"), dataClassification: "internal" }]} onSubmit={vi.fn()} />);

        expect(screen.getByText("chat.tool_approval_classification_internal")).toBeInTheDocument();
    });

    it("shows one request at a time", async () => {
        render(<ToolApproval requests={[request("a"), request("b")]} onSubmit={vi.fn()} />);

        expect(screen.getByText("Anfrage a")).toBeInTheDocument();
        expect(screen.queryByText("Anfrage b")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "chat.tool_approval_approve_label" }));

        expect(screen.queryByText("Anfrage a")).not.toBeInTheDocument();
        expect(screen.getByText("Anfrage b")).toBeInTheDocument();
    });

    it("does not let a double click decide the next request unseen", async () => {
        const onSubmit = vi.fn();
        render(<ToolApproval requests={[request("a"), request("b")]} onSubmit={onSubmit} />);

        await userEvent.dblClick(screen.getByRole("button", { name: "chat.tool_approval_approve_label" }));

        expect(screen.getByText("Anfrage b")).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("waits until every request is decided", async () => {
        const onSubmit = vi.fn();
        render(<ToolApproval requests={[request("a"), request("b")]} onSubmit={onSubmit} />);

        await userEvent.click(screen.getAllByRole("button", { name: "chat.tool_approval_approve_label" })[0]);
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.queryByText("Anfrage a")).not.toBeInTheDocument();

        await new Promise(resolve => setTimeout(resolve, 510));
        await userEvent.click(screen.getByRole("button", { name: "chat.tool_approval_reject_label" }));
        expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ a: "approve", b: "reject" });
    });

    it("keeps keyboard users at the remaining request, without arming a button", async () => {
        const onSubmit = vi.fn();
        render(<ToolApproval requests={[request("a"), request("b")]} onSubmit={onSubmit} />);

        await userEvent.tab();
        expect(screen.getByRole("button", { name: "chat.tool_approval_reject_label" })).toHaveFocus();
        await userEvent.tab();
        expect(screen.getAllByRole("button", { name: "chat.tool_approval_approve_label" })[0]).toHaveFocus();
        await userEvent.keyboard("{Enter}{Enter}");
        expect(onSubmit).not.toHaveBeenCalled();

        await userEvent.tab();
        expect(screen.getByRole("button", { name: "chat.tool_approval_reject_label" })).toHaveFocus();
    });

    it("shows the position only when several requests are pending", () => {
        const { unmount } = render(<ToolApproval requests={[request("a")]} onSubmit={vi.fn()} />);
        expect(screen.queryByText("chat.tool_approval_position")).not.toBeInTheDocument();
        unmount();

        render(<ToolApproval requests={[request("a"), request("b")]} onSubmit={vi.fn()} />);
        expect(screen.getByText("chat.tool_approval_position")).toBeInTheDocument();
    });
});
