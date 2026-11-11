import { getCanvasApi, getCanvasRevisionsApi } from "../api/core-client";

/** Lossless ProseMirror snapshot of the canvas document. */
export interface CanvasRevision {
    /** Monotonic; shared with the canvas_revision stream metadata */
    revision: number;
    /** ProseMirror document (editor.getJSON()) */
    doc_json: unknown;
    timestamp: number;
    source: "agent" | "manual" | "restore";
}

/** Two client-owned FIFO rings; the caps and eviction logic live in the controller. */
export interface CanvasRevisions {
    auto: CanvasRevision[];
    manual: CanvasRevision[];
}

const isRevisionEntry = (entry: unknown): entry is CanvasRevision => {
    if (typeof entry !== "object" || entry === null) return false;
    const { revision, doc_json, timestamp } = entry as Record<string, unknown>;
    return (
        typeof revision === "number" &&
        Number.isFinite(revision) &&
        doc_json !== null &&
        doc_json !== undefined &&
        typeof timestamp === "number" &&
        Number.isFinite(timestamp)
    );
};

const parseRevisionRing = (entries: unknown): CanvasRevision[] => (Array.isArray(entries) ? entries.filter(isRevisionEntry) : []);

/**
 * Revision rings arrive from the server API and are untrusted: malformed shapes
 * must degrade to empty rings instead of crashing the consumer.
 */
export function parseCanvasRevisions(value: unknown): CanvasRevisions {
    if (typeof value !== "object" || value === null) return { auto: [], manual: [] };
    const { auto, manual } = value as Record<string, unknown>;
    return { auto: parseRevisionRing(auto), manual: parseRevisionRing(manual) };
}

/**
 * Canvas content for a conversation: the server copy (the single source of
 * truth, written with every chat turn from any device) or null when no server
 * canvas exists / the load failed.
 */
export async function loadCanvasState(conversationId: string): Promise<string | null> {
    const server = await getCanvasApi(conversationId).catch(error => {
        console.error(`Failed to load canvas ${conversationId} from the server`, error);
        return null;
    });
    return server?.content ?? null;
}

/**
 * Canvas revision rings for a conversation, from the server (the single source
 * of truth) or null when none are stored / the load failed.
 */
export async function loadCanvasRevisions(conversationId: string): Promise<CanvasRevisions | null> {
    return getCanvasRevisionsApi(conversationId).catch(error => {
        console.error(`Failed to load canvas revisions ${conversationId} from the server`, error);
        return null;
    });
}
