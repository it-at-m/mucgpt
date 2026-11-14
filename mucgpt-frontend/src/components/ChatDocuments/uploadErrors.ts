import { ApiError } from "../../api/fetch-utils";

const STATUS_ERROR_KEYS: Record<number, string> = {
    409: "document_library.upload_error_full",
    413: "document_library.upload_error_too_large",
    415: "document_library.upload_error_unsupported",
    422: "document_library.upload_error_no_text",
    503: "document_library.upload_error_disabled"
};

/** Maps an upload failure to a translation key; raw server messages never reach the UI. */
export const getUploadErrorKey = (error: unknown): string =>
    (error instanceof ApiError ? STATUS_ERROR_KEYS[error.status] : undefined) ?? "document_library.upload_error_generic";
