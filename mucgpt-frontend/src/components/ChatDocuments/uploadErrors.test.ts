import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/fetch-utils";
import { getUploadErrorKey } from "./uploadErrors";

describe("getUploadErrorKey", () => {
    it("translates known rejections and never exposes other server or network messages", () => {
        expect(getUploadErrorKey(new ApiError("Document library limit of 10 reached", 409))).toBe("document_library.upload_error_full");
        expect(getUploadErrorKey(new ApiError("Parser service timed out.", 504))).toBe("document_library.upload_error_generic");
        expect(getUploadErrorKey(new Error("offline"))).toBe("document_library.upload_error_generic");
    });
});
