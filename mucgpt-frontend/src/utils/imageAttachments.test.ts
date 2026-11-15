// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { classifyFiles, formatMaxBytes, isSupportedImageFile, pastedImageFilename, resolveImageInput } from "./imageAttachments";
import type { ApplicationConfig } from "../api/models";

const ENABLED_CONFIG: ApplicationConfig["image_input"] = {
    enabled: true,
    max_upload_bytes: 1024,
    max_images_per_message: 2,
    max_pixels: 20_000_000,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"]
};

// Minimal valid file signatures (payload bodies are irrelevant for classification).
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0];
const GIF_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF_BYTES = [0x25, 0x50, 0x44, 0x46];

function file(bytes: number[], name: string, type: string): File {
    return new File([new Uint8Array(bytes).buffer as ArrayBuffer], name, { type });
}

describe("resolveImageInput", () => {
    it("fails closed when the config is absent or disabled", () => {
        expect(resolveImageInput(undefined).enabled).toBe(false);
        expect(resolveImageInput(null).enabled).toBe(false);
        expect(resolveImageInput({ image_input: undefined } as ApplicationConfig).enabled).toBe(false);
    });

    it("passes through an enabled config", () => {
        const resolved = resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig);
        expect(resolved).toEqual(ENABLED_CONFIG);
    });
});

describe("isSupportedImageFile", () => {
    it("accepts the allowed formats by signature, not by declared MIME", async () => {
        const imageInput = resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig);
        // Spoofed MIME type must not matter.
        expect(await isSupportedImageFile(file(PNG_BYTES, "x.bin", "application/octet-stream"), imageInput)).toBe(true);
        expect(await isSupportedImageFile(file(JPEG_BYTES, "x", "image/jpeg"), imageInput)).toBe(true);
        expect(await isSupportedImageFile(file(WEBP_BYTES, "x", "image/webp"), imageInput)).toBe(true);
    });

    it("rejects non-image data and disallowed image types", async () => {
        const imageInput = resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig);
        expect(await isSupportedImageFile(file(PDF_BYTES, "x.pdf", "application/pdf"), imageInput)).toBe(false);
        expect(await isSupportedImageFile(file(GIF_BYTES, "x.gif", "image/gif"), imageInput)).toBe(false);
    });
});

describe("classifyFiles", () => {
    it("routes supported images to the image pipeline and documents onward", async () => {
        const result = await classifyFiles(
            [file(PNG_BYTES, "shot.png", "image/png"), file(PDF_BYTES, "doc.pdf", "application/pdf"), file(JPEG_BYTES, "photo.jpg", "image/jpeg")],
            resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig)
        );

        expect(result.images.map(f => f.name)).toEqual(["shot.png", "photo.jpg"]);
        expect(result.documents.map(f => f.name)).toEqual(["doc.pdf"]);
        expect(result.rejected).toEqual([]);
    });

    it("rejects unsupported image types instead of parsing them as documents", async () => {
        const result = await classifyFiles([file(GIF_BYTES, "anim.gif", "image/gif")], resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig));

        expect(result.images).toEqual([]);
        expect(result.documents).toEqual([]);
        expect(result.rejected).toEqual([{ file: expect.anything(), reason: "unsupported-format" }]);
    });

    it("rejects oversized images before upload", async () => {
        const body = new Uint8Array(2048);
        body.set(new Uint8Array(PNG_BYTES), 0); // valid PNG signature, oversized payload
        const huge = file(Array.from(body), "big.png", "image/png");
        const result = await classifyFiles([huge], resolveImageInput({ image_input: ENABLED_CONFIG } as ApplicationConfig));

        expect(result.images).toEqual([]);
        expect(result.rejected).toEqual([{ file: huge, reason: "too-large" }]);
    });

    it("fails closed when image input is disabled", async () => {
        const result = await classifyFiles(
            [file(PNG_BYTES, "shot.png", "image/png")],
            resolveImageInput({ image_input: { ...ENABLED_CONFIG, enabled: false } } as ApplicationConfig)
        );

        expect(result.images).toEqual([]);
        expect(result.rejected).toEqual([{ file: expect.anything(), reason: "image-disabled" }]);
    });
});

describe("helpers", () => {
    it("formats byte limits readably", () => {
        expect(formatMaxBytes(10 * 1024 * 1024)).toBe("10 MB");
        expect(formatMaxBytes(512 * 1024)).toBe("512 KB");
    });

    it("generates unique names for pasted images", () => {
        const first = pastedImageFilename();
        const second = pastedImageFilename();
        expect(first).toMatch(/^pasted-image-[0-9a-f]{8}\.png$/);
        expect(first).not.toBe(second);
    });
});
