import type { Interrupt } from "@ag-ui/core";
import { describe, expect, it } from "vitest";

import { buildToolApprovalResume, toToolApprovalRequests } from "./toolApproval";

const interrupt = (id: string, overrides: Partial<Interrupt> = {}): Interrupt => ({
    id,
    reason: "tool_approval",
    toolCallId: id,
    message: "Durchsuche das Internet",
    metadata: { mucgpt: { toolName: "web_search", args: { query: "Kita" }, dataClassification: "public" } },
    ...overrides
});

describe("toToolApprovalRequests", () => {
    it("reads tool and real arguments", () => {
        expect(toToolApprovalRequests([interrupt("a")])).toEqual([{ id: "a", toolName: "web_search", args: { query: "Kita" }, dataClassification: "public" }]);
    });

    it("reads the data classification", () => {
        const internal = interrupt("a", { metadata: { mucgpt: { toolName: "wiki", args: {}, dataClassification: "internal" } } });

        expect(toToolApprovalRequests([internal])[0].dataClassification).toBe("internal");
    });

    it("refuses interrupts it cannot show to the user", () => {
        expect(() => toToolApprovalRequests([interrupt("a", { reason: "missing_value" })])).toThrow("Unsupported interrupt");
        expect(() => toToolApprovalRequests([interrupt("a", { metadata: {} })])).toThrow("Unsupported interrupt");
        expect(() => toToolApprovalRequests([interrupt("a", { toolCallId: "other" })])).toThrow("Unsupported interrupt");
        expect(() => toToolApprovalRequests([interrupt("a", { metadata: { mucgpt: { toolName: "wiki", args: {}, dataClassification: "secret" } } })])).toThrow(
            "Unsupported interrupt"
        );
    });
});

describe("buildToolApprovalResume", () => {
    it("answers each interrupt with its decision", () => {
        expect(buildToolApprovalResume([interrupt("a"), interrupt("b")], { a: "approve", b: "reject" })).toEqual([
            { interruptId: "a", status: "resolved", payload: { decision: "approve" } },
            { interruptId: "b", status: "resolved", payload: { decision: "reject" } }
        ]);
    });

    it("cancels interrupts that have no decision", () => {
        expect(buildToolApprovalResume([interrupt("a"), interrupt("b")], { a: "approve" })[1]).toEqual({ interruptId: "b", status: "cancelled" });
    });
});
