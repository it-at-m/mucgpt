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
