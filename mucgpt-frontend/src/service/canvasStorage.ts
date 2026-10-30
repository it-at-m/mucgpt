import { openDB, type IDBPDatabase } from "idb";

import { getCanvasApi, getCanvasRevisionsApi } from "../api/core-client";
import { CANVAS_STORE } from "../constants";
import type { IndexedDBStorage } from "./indexedDBStorage";

/** Lossless ProseMirror snapshot of the canvas document. */
export interface CanvasRevision {
    /** Monotonic; shared with the canvas_revision stream metadata */
    revision: number;
    /** ProseMirror document (editor.getJSON()) */
    doc_json: unknown;
    timestamp: number;
    source: "agent" | "manual" | "restore" | "local";
}

/** Two client-owned FIFO rings; the caps and eviction logic live in the controller. */
export interface CanvasRevisions {
    auto: CanvasRevision[];
    manual: CanvasRevision[];
}

export interface CanvasDBRecord {
    conversation_id: string;
    content: string;
    updated_at: number;
    revisions: CanvasRevisions;
}

export interface CanvasStorageService {
    getCanvas(conversationId: string): Promise<{ content: string; updated_at: number } | null>;
    saveCanvas(conversationId: string, content: string): Promise<void>;
    deleteCanvas(conversationId: string): Promise<void>;
    getRevisions(conversationId: string): Promise<CanvasRevisions | null>;
    saveRevisions(conversationId: string, revisions: CanvasRevisions): Promise<void>;
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
 * Revision rings arrive from the server API or IndexedDB and are untrusted:
 * malformed shapes must degrade to empty rings instead of crashing the consumer.
 */
export function parseCanvasRevisions(value: unknown): CanvasRevisions {
    if (typeof value !== "object" || value === null) return { auto: [], manual: [] };
    const { auto, manual } = value as Record<string, unknown>;
    return { auto: parseRevisionRing(auto), manual: parseRevisionRing(manual) };
}

function emptyRecord(conversationId: string): CanvasDBRecord {
    return {
        conversation_id: conversationId,
        content: "",
        updated_at: Date.now(),
        revisions: { auto: [], manual: [] }
    };
}

export class CanvasStorage implements CanvasStorageService {
    constructor(private readonly config: IndexedDBStorage = CANVAS_STORE) {}

    private async connectToDB(): Promise<IDBPDatabase<CanvasDBRecord>> {
        return openDB<CanvasDBRecord>(this.config.db_name, this.config.db_version, {
            upgrade: db => {
                if (!db.objectStoreNames.contains(this.config.objectStore_name)) {
                    db.createObjectStore(this.config.objectStore_name, {
                        keyPath: "conversation_id"
                    });
                }
            }
        });
    }

    private async getRecord(conversationId: string): Promise<CanvasDBRecord | undefined> {
        const db = await this.connectToDB();
        return db.get(this.config.objectStore_name, conversationId);
    }

    private async putRecord(record: CanvasDBRecord): Promise<void> {
        const db = await this.connectToDB();
        await db.put(this.config.objectStore_name, record);
    }

    async getCanvas(conversationId: string): Promise<{ content: string; updated_at: number } | null> {
        const record = await this.getRecord(conversationId);
        if (!record) return null;
        return { content: record.content, updated_at: record.updated_at };
    }

    async saveCanvas(conversationId: string, content: string): Promise<void> {
        const record = (await this.getRecord(conversationId)) ?? emptyRecord(conversationId);
        await this.putRecord({ ...record, content, updated_at: Date.now() });
    }

    async deleteCanvas(conversationId: string): Promise<void> {
        const db = await this.connectToDB();
        await db.delete(this.config.objectStore_name, conversationId);
    }

    async getRevisions(conversationId: string): Promise<CanvasRevisions | null> {
        return (await this.getRecord(conversationId))?.revisions ?? null;
    }

    async saveRevisions(conversationId: string, revisions: CanvasRevisions): Promise<void> {
        const record = (await this.getRecord(conversationId)) ?? emptyRecord(conversationId);
        await this.putRecord({ ...record, revisions });
    }
}

export const canvasStorage = new CanvasStorage();

/**
 * Reconciled canvas content for a conversation. The server copy is
 * authoritative when one exists; `supersededLocal` carries the local-only
 * content that lost that comparison, so the caller can snapshot it into the
 * revision rings instead of dropping it.
 */
export interface LoadedCanvasState {
    content: string | null;
    supersededLocal: string | null;
}

/**
 * Canvas content for a conversation: the server copy when one exists (the
 * authoritative state, written with every chat turn from any device), the
 * local IndexedDB record otherwise. A differing local copy is reported as
 * superseded so it can be preserved as a revision; a failed IndexedDB read
 * counts as a cache miss and leaves the server path intact.
 */
export async function loadCanvasState(conversationId: string, serverConversationId: string = conversationId): Promise<LoadedCanvasState> {
    const local = await canvasStorage.getCanvas(conversationId).catch(error => {
        console.error(`Failed to read canvas ${conversationId} from IndexedDB`, error);
        return null;
    });
    const server = await getCanvasApi(serverConversationId).catch(error => {
        console.error(`Failed to load canvas ${serverConversationId} from the server`, error);
        return null;
    });
    if (server === null) {
        return { content: local?.content ?? null, supersededLocal: null };
    }
    return {
        content: server.content,
        supersededLocal: local?.content && local.content !== server.content ? local.content : null
    };
}

/**
 * Canvas revision rings for a conversation: local first, server as fallback.
 */
export async function loadCanvasRevisions(conversationId: string, serverConversationId: string = conversationId): Promise<CanvasRevisions | null> {
    const local = await canvasStorage.getRevisions(conversationId).catch(error => {
        console.error(`Failed to read canvas revisions ${conversationId} from IndexedDB`, error);
        return null;
    });
    if (local !== null) {
        return local;
    }
    return getCanvasRevisionsApi(serverConversationId).catch(error => {
        console.error(`Failed to load canvas revisions ${serverConversationId} from the server`, error);
        return null;
    });
}
