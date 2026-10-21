import type { CanvasState } from "../api/models";
import type { CanvasRevisions } from "../service/canvasStorage";
import type { CanvasStreamEvent } from "../utils/canvasStream";

/**
 * Interface between the canvas UI and the chat page.
 * Implemented by useCanvasController; consumed by the chat page wiring.
 */
export interface CanvasController {
    isOpen: boolean;
    setIsOpen(open: boolean): void;
    /** True while the agent is writing */
    isLocked: boolean;
    lock(): void;
    unlock(): void;
    getMarkdown(): string;
    /** expandMarks: selection-expansion rule, v1.1 */
    getSelectionMarkdown(opts?: { expandMarks?: boolean }): string | null;
    /** Full replace; clears selection */
    setMarkdown(md: string): void;
    /** Null when closed or empty */
    toCanvasState(): CanvasState | null;
    /** APPEND → live insert; UPDATE → replace doc */
    applyStreamEvent(ev: CanvasStreamEvent): void;
    /** Debounced; used for autosave */
    subscribe(cb: (markdown: string) => void): () => void;
    /** PM-JSON snapshot into the revision rings */
    snapshot(source: "agent" | "manual" | "restore"): void;
    listRevisions(): CanvasRevisions;
    /** Non-destructive: setContent(doc_json) as new transaction; undoable via Ctrl+Z */
    restore(revision: number): void;
}
