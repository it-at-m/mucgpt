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

const CANVAS_STREAM_STATES: ReadonlySet<string> = new Set(["STARTED", "UPDATE", "APPEND", "ENDED"]);
export const CANVAS_STREAM_CONTENT_LIMIT = 512 * 1024;

/**
 * Streamed events originate from the backend response, so they are untrusted:
 * non-string content would throw inside the stream subscription and huge
 * payloads would freeze the tab during the synchronous markdown/ProseMirror parse.
 */
export function parseCanvasStreamEvent(value: unknown): CanvasStreamEvent | null {
    if (typeof value !== "object" || value === null) return null;
    const { state, content, metadata } = value as Record<string, unknown>;
    if (typeof state !== "string" || !CANVAS_STREAM_STATES.has(state)) return null;
    if (typeof content !== "string" || content.length > CANVAS_STREAM_CONTENT_LIMIT) return null;
    // metadata: null is the backend's serialization of "no metadata" (e.g. every
    // canvas_edit UPDATE), so it must be treated like an absent field.
    if (metadata !== undefined && metadata !== null) {
        if (typeof metadata !== "object") return null;
        const revision = (metadata as Record<string, unknown>).canvas_revision;
        if (revision !== undefined && !Number.isFinite(revision)) return null;
    }
    return { state: state as CanvasStreamEvent["state"], content, metadata: (metadata ?? undefined) as CanvasStreamEvent["metadata"] };
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
