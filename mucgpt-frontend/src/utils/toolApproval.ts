import { buildResumeArray } from "@ag-ui/client";
import type { Interrupt, ResumeEntry } from "@ag-ui/core";

const TOOL_APPROVAL_REASON = "tool_approval";

const DATA_CLASSIFICATIONS = ["public", "internal", "confidential"] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export type ToolDecision = "approve" | "reject";
export type ToolDecisions = Record<string, ToolDecision>;

export interface ToolApprovalRequest {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    dataClassification: DataClassification;
}

export type ToolApprovalHandler = (requests: ToolApprovalRequest[]) => Promise<ToolDecisions | null>;

const isDataClassification = (value: unknown): value is DataClassification => DATA_CLASSIFICATIONS.some(level => level === value);

export const toToolApprovalRequests = (interrupts: Interrupt[]): ToolApprovalRequest[] =>
    interrupts.map(interrupt => {
        const details = (interrupt.metadata as { mucgpt?: { toolName?: unknown; args?: unknown; dataClassification?: unknown } } | undefined)?.mucgpt;
        if (
            interrupt.reason !== TOOL_APPROVAL_REASON ||
            interrupt.toolCallId !== interrupt.id ||
            typeof details?.toolName !== "string" ||
            !isDataClassification(details.dataClassification)
        ) {
            throw new Error(`Unsupported interrupt: ${interrupt.reason}`);
        }
        return {
            id: interrupt.id,
            toolName: details.toolName,
            args: (details.args ?? {}) as Record<string, unknown>,
            dataClassification: details.dataClassification
        };
    });

export const buildToolApprovalResume = (interrupts: Interrupt[], decisions: ToolDecisions): ResumeEntry[] =>
    buildResumeArray(
        interrupts,
        Object.fromEntries(
            interrupts.map(interrupt => {
                const decision = decisions[interrupt.id];
                return [interrupt.id, decision ? { status: "resolved" as const, payload: { decision } } : { status: "cancelled" as const }];
            })
        )
    );
