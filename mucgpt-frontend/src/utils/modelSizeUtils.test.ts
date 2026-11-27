import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchModelFileSizes } from "./modelSizeUtils";

describe("fetchModelFileSizes", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns a filename-to-size map for the onnx tree by default", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: unknown) => {
                expect(String(url)).toBe("https://huggingface.co/api/models/org/model/tree/main/onnx/");
                return new Response(
                    JSON.stringify([
                        { type: "file", path: "onnx/model.onnx", size: 1234 },
                        { type: "file", path: "onnx/weights.bin", size: 5678 },
                        { type: "dir", path: "onnx/subdir" },
                        { type: "file", path: "onnx/empty.bin" }
                    ]),
                    { status: 200 }
                );
            })
        );

        await expect(fetchModelFileSizes("org/model")).resolves.toEqual({
            "onnx/model.onnx": 1234,
            "onnx/weights.bin": 5678
        });
    });

    it("requests the repo root when treePath is empty", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchModelFileSizes("org/model", "")).resolves.toEqual({});
        expect(fetchMock).toHaveBeenCalledWith(
            "https://huggingface.co/api/models/org/model/tree/main/",
            expect.objectContaining({ headers: { Accept: "application/json" }, signal: expect.any(AbortSignal) })
        );
    });

    it("returns an empty map when the Hub API answers with an HTTP error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 404 }))
        );
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(fetchModelFileSizes("org/missing")).resolves.toEqual({});
        expect(errorSpy).toHaveBeenCalledOnce();
    });

    it("returns an empty map when the request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("network down");
            })
        );
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(fetchModelFileSizes("org/model")).resolves.toEqual({});
        expect(errorSpy).toHaveBeenCalledOnce();
    });
});
