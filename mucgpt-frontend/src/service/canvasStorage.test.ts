import { beforeEach, describe, expect, it, vi } from "vitest";

type CanvasDBRecord = {
    conversation_id: string;
    content: string;
    updated_at: number;
    revisions: unknown;
};

const { idbStore, getCanvasApiMock, getCanvasRevisionsApiMock } = vi.hoisted(() => ({
    idbStore: new Map<string, CanvasDBRecord>(),
    getCanvasApiMock: vi.fn(),
    getCanvasRevisionsApiMock: vi.fn()
}));

vi.mock("idb", () => ({
    openDB: async () => ({
        get: async (_storeName: string, key: string) => idbStore.get(key),
        put: async (_storeName: string, value: CanvasDBRecord) => {
            idbStore.set(value.conversation_id, value);
        },
        delete: async (_storeName: string, key: string) => {
            idbStore.delete(key);
        }
    })
}));

vi.mock("../api/core-client", () => ({
    getCanvasApi: (...args: unknown[]) => getCanvasApiMock(...args),
    getCanvasRevisionsApi: (...args: unknown[]) => getCanvasRevisionsApiMock(...args)
}));

import { canvasStorage, loadCanvasRevisions, loadCanvasState } from "./canvasStorage";

describe("loadCanvasState", () => {
    beforeEach(() => {
        idbStore.clear();
        getCanvasApiMock.mockReset();
        getCanvasRevisionsApiMock.mockReset();
    });

    it("prefers the local record and does not hit the server", async () => {
        await canvasStorage.saveCanvas("conv-1", "local content");

        expect(await loadCanvasState("conv-1")).toBe("local content");
        expect(getCanvasApiMock).not.toHaveBeenCalled();
    });

    it("falls back to the server when no local record exists", async () => {
        getCanvasApiMock.mockResolvedValue({ content: "server content", updated_at: "2026-01-01T00:00:00Z" });

        expect(await loadCanvasState("conv-2")).toBe("server content");
        expect(getCanvasApiMock).toHaveBeenCalledWith("conv-2");
    });

    it("returns null when local and server fail", async () => {
        getCanvasApiMock.mockRejectedValue(new Error("server down"));

        expect(await loadCanvasState("conv-3")).toBeNull();
    });
});

describe("loadCanvasRevisions", () => {
    beforeEach(() => {
        idbStore.clear();
        getCanvasApiMock.mockReset();
        getCanvasRevisionsApiMock.mockReset();
    });

    it("prefers the local rings and does not hit the server", async () => {
        const rings = { auto: [{ revision: 1, doc_json: {}, timestamp: 1, source: "agent" as const }], manual: [] };
        await canvasStorage.saveRevisions("conv-1", rings);

        expect(await loadCanvasRevisions("conv-1")).toEqual(rings);
        expect(getCanvasRevisionsApiMock).not.toHaveBeenCalled();
    });

    it("falls back to the server when no local record exists", async () => {
        const rings = { auto: [], manual: [] };
        getCanvasRevisionsApiMock.mockResolvedValue(rings);

        expect(await loadCanvasRevisions("conv-2")).toEqual(rings);
        expect(getCanvasRevisionsApiMock).toHaveBeenCalledWith("conv-2");
    });

    it("returns null when local and server fail", async () => {
        getCanvasRevisionsApiMock.mockRejectedValue(new Error("server down"));

        expect(await loadCanvasRevisions("conv-3")).toBeNull();
    });
});
