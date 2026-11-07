import { describe, expect, it, vi, beforeEach } from "vitest";

const { getCanvasApiMock, getCanvasRevisionsApiMock } = vi.hoisted(() => ({
    getCanvasApiMock: vi.fn(),
    getCanvasRevisionsApiMock: vi.fn()
}));

vi.mock("../api/core-client", () => ({
    getCanvasApi: (...args: unknown[]) => getCanvasApiMock(...args),
    getCanvasRevisionsApi: (...args: unknown[]) => getCanvasRevisionsApiMock(...args)
}));

import { loadCanvasRevisions, loadCanvasState, parseCanvasRevisions } from "./canvasStorage";

describe("loadCanvasState", () => {
    beforeEach(() => {
        getCanvasApiMock.mockReset();
        getCanvasRevisionsApiMock.mockReset();
    });

    it("returns the server copy as the single source of truth", async () => {
        getCanvasApiMock.mockResolvedValue({ content: "server content", updated_at: "2026-01-01T00:00:00Z" });

        expect(await loadCanvasState("conv-1")).toBe("server content");
        expect(getCanvasApiMock).toHaveBeenCalledWith("conv-1");
        expect(getCanvasRevisionsApiMock).not.toHaveBeenCalled();
    });

    it("returns null when the server has no canvas", async () => {
        getCanvasApiMock.mockResolvedValue(null);

        expect(await loadCanvasState("conv-2")).toBeNull();
    });

    it("treats a blank server canvas as legitimate content", async () => {
        getCanvasApiMock.mockResolvedValue({ content: "", updated_at: "2026-01-01T00:00:00Z" });

        expect(await loadCanvasState("conv-3")).toBe("");
    });

    it("returns null when the server request fails", async () => {
        getCanvasApiMock.mockRejectedValue(new Error("server down"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            expect(await loadCanvasState("conv-4")).toBeNull();
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe("loadCanvasRevisions", () => {
    beforeEach(() => {
        getCanvasApiMock.mockReset();
        getCanvasRevisionsApiMock.mockReset();
    });

    it("returns the rings from the server", async () => {
        const rings = { auto: [{ revision: 1, doc_json: {}, timestamp: 1, source: "agent" as const }], manual: [] };
        getCanvasRevisionsApiMock.mockResolvedValue(rings);

        expect(await loadCanvasRevisions("conv-2")).toEqual(rings);
        expect(getCanvasRevisionsApiMock).toHaveBeenCalledWith("conv-2");
    });

    it("returns null when none are stored", async () => {
        getCanvasRevisionsApiMock.mockResolvedValue(null);

        expect(await loadCanvasRevisions("conv-5")).toBeNull();
    });

    it("returns null when the server request fails", async () => {
        getCanvasRevisionsApiMock.mockRejectedValue(new Error("server down"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            expect(await loadCanvasRevisions("conv-3")).toBeNull();
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe("parseCanvasRevisions", () => {
    it("degrades non-array rings to empty rings", () => {
        expect(parseCanvasRevisions({ auto: null, manual: [] })).toEqual({ auto: [], manual: [] });
        expect(parseCanvasRevisions({ auto: "nope", manual: 5 })).toEqual({ auto: [], manual: [] });
    });

    it("returns empty rings for non-object values", () => {
        expect(parseCanvasRevisions(null)).toEqual({ auto: [], manual: [] });
        expect(parseCanvasRevisions("garbage")).toEqual({ auto: [], manual: [] });
    });

    it("drops entries without a finite numeric revision or without a document", () => {
        const valid = { revision: 2, doc_json: { type: "doc" }, timestamp: 2, source: "agent" as const };
        expect(parseCanvasRevisions({ auto: [valid, { revision: "x" }, { revision: Number.POSITIVE_INFINITY }, { revision: 3 }, null], manual: [] })).toEqual({
            auto: [valid],
            manual: []
        });
    });

    it("drops entries with a non-finite timestamp", () => {
        const valid = { revision: 1, doc_json: { type: "doc" }, timestamp: 1, source: "agent" as const };
        expect(
            parseCanvasRevisions({
                auto: [
                    valid,
                    { revision: 2, doc_json: {}, timestamp: "garbage", source: "agent" },
                    { revision: 3, doc_json: {}, timestamp: Number.NaN },
                    { revision: 4, doc_json: {} }
                ],
                manual: []
            })
        ).toEqual({ auto: [valid], manual: [] });
    });

    it("keeps well-formed rings untouched", () => {
        const rings = {
            auto: [{ revision: 1, doc_json: {}, timestamp: 1, source: "agent" as const }],
            manual: [{ revision: 2, doc_json: {}, timestamp: 2, source: "manual" as const }]
        };
        expect(parseCanvasRevisions(rings)).toEqual(rings);
    });
});
