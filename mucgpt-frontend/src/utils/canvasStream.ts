/**
 * Canvas stream events: AG-UI tool-call events for the
 * "Canvas" tool, routed to the editor instead of the chat bubble.
 */
export interface CanvasStreamEvent {
    state: "STARTED" | "UPDATE" | "APPEND" | "ENDED";
    /** APPEND: delta; UPDATE: full authoritative markdown */
    content: string;
    metadata?: { canvas_revision?: number };
}

export function isCanvasToolCall(name: string): boolean {
    return name === "Canvas";
}

/** All three agent canvas tools, auto-enabled while the canvas is open. */
export const CANVAS_TOOL_IDS = ["canvas_write", "canvas_edit", "canvas_read"] as const;

type CopyIntoCanvasHandler = (markdown: string) => void;
let copyIntoCanvasHandler: CopyIntoCanvasHandler | undefined;

/**
 * Bridge for the legacy fenced fallback: fragments render deep inside answers with
 * only their content, so the chat pages register how "Copy into Canvas" reaches
 * the live canvas controller.
 */
export function setCopyIntoCanvasHandler(handler: CopyIntoCanvasHandler | undefined): void {
    copyIntoCanvasHandler = handler;
}

export function copyIntoCanvas(markdown: string): void {
    copyIntoCanvasHandler?.(markdown);
}
