import type { ApplicationConfig, ImageInputConfig } from "../api/models";

/**
 * Shared classification and validation for chat image attachments (#1398).
 *
 * Supported images are routed to the dedicated image upload pipeline and must
 * never reach document parsing; everything else keeps the document flow.
 * Classification never trusts the browser MIME type alone: the file signature
 * decides, so a GIF renamed to .png cannot sneak into the image pipeline.
 */

/** Defaults mirroring the backend; absent config fails closed (disabled). */
export const DEFAULT_IMAGE_INPUT: ImageInputConfig = {
    enabled: false,
    max_upload_bytes: 10 * 1024 * 1024,
    max_images_per_message: 5,
    max_pixels: 20_000_000,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"]
};

export type RejectionReason = "unsupported-format" | "too-large" | "image-disabled";

export type RejectedFile = { file: File; reason: RejectionReason };

export type FileClassification = {
    images: File[];
    documents: File[];
    rejected: RejectedFile[];
};

export function resolveImageInput(config: ApplicationConfig | undefined | null): ImageInputConfig {
    const imageInput = config?.image_input;
    if (!imageInput?.enabled) {
        return DEFAULT_IMAGE_INPUT;
    }
    return {
        enabled: true,
        max_upload_bytes: imageInput.max_upload_bytes,
        max_images_per_message: imageInput.max_images_per_message,
        max_pixels: imageInput.max_pixels,
        allowed_mime_types: imageInput.allowed_mime_types
    };
}

type ImageSignature = { kind: "jpeg" | "png" | "webp" | "other-image" };

/** Sniff the actual file signature; browser MIME types are untrusted. */
async function sniffImageSignature(file: File | Blob): Promise<ImageSignature | null> {
    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    } catch {
        return null;
    }
    const startsWith = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);
    const ascii = (offset: number, text: string) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

    if (startsWith([0xff, 0xd8, 0xff])) {
        return { kind: "jpeg" };
    }
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { kind: "png" };
    }
    if (startsWith([0x52, 0x49, 0x46, 0x46]) && ascii(8, "WEBP")) {
        return { kind: "webp" };
    }
    if (startsWith([0x47, 0x49, 0x46, 0x38])) {
        // GIF is an image, but not a supported upload target: reject it as an
        // image instead of silently sending it to document parsing.
        return { kind: "other-image" };
    }
    return null;
}

const SIGNATURE_TO_MIME: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
};

/** True for a file whose signature matches one of the configured allowlisted types. */
export async function isSupportedImageFile(file: File, imageInput: ImageInputConfig): Promise<boolean> {
    const signature = await sniffImageSignature(file);
    if (!signature || !(signature.kind in SIGNATURE_TO_MIME)) {
        return false;
    }
    return imageInput.allowed_mime_types.includes(SIGNATURE_TO_MIME[signature.kind]);
}

/**
 * Split a mixed drop/paste/selection into the image pipeline and the
 * document pipeline. Image-typed files that are unsupported (e.g. GIF, HEIC)
 * are rejected explicitly instead of being parsed as documents.
 */
export async function classifyFiles(files: File[], imageInput: ImageInputConfig): Promise<FileClassification> {
    const classification: FileClassification = {
        images: [],
        documents: [],
        rejected: []
    };
    for (const file of files) {
        const signature = await sniffImageSignature(file);
        if (!signature) {
            classification.documents.push(file);
            continue;
        }
        if (signature.kind === "other-image") {
            classification.rejected.push({ file, reason: "unsupported-format" });
            continue;
        }
        const mime = SIGNATURE_TO_MIME[signature.kind];
        if (!imageInput.enabled) {
            classification.rejected.push({ file, reason: "image-disabled" });
            continue;
        }
        if (!imageInput.allowed_mime_types.includes(mime)) {
            classification.rejected.push({ file, reason: "unsupported-format" });
            continue;
        }
        if (file.size > imageInput.max_upload_bytes) {
            classification.rejected.push({ file, reason: "too-large" });
            continue;
        }
        classification.images.push(file);
    }
    return classification;
}

/** Excess count for the new images of one message, given the bound. */
export function imageCountExceeded(newImageCount: number, imageInput: ImageInputConfig): boolean {
    return newImageCount > imageInput.max_images_per_message;
}

export function formatMaxBytes(maxBytes: number): string {
    if (maxBytes % (1024 * 1024) === 0) {
        return `${maxBytes / (1024 * 1024)} MB`;
    }
    return `${Math.round(maxBytes / 1024)} KB`;
}

/** Generated filename for pasted clipboard images (they have none). */
export function pastedImageFilename(extension: "png" | "jpeg" | "webp" = "png"): string {
    const suffix = crypto.randomUUID().split("-")[0];
    return `pasted-image-${suffix}.${extension}`;
}
