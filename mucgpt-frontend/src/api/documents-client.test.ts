// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "./fetch-utils";
import { deleteDocumentApi, listDocumentsApi, uploadDocumentApi } from "./documents-client";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

it("lists documents with a GET request", async () => {
    const entries = [{ document_id: "doc-1", filename: "a.pdf" }];
    fetchMock.mockResolvedValue(new Response(JSON.stringify(entries), { status: 200 }));

    await expect(listDocumentsApi()).resolves.toEqual(entries);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/documents", expect.objectContaining({ redirect: "manual" }));
});

it("uploads a file as multipart FormData without a manual Content-Type", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ document_id: "doc-1" }), { status: 200 }));
    const file = new File(["hello"], "hello.pdf", { type: "application/pdf" });

    await uploadDocumentApi(file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/v1/documents");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
    expect((init?.headers as Headers).get("Content-Type")).toBeNull();
});

it("deletes a document with an encoded id and tolerates any ok response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteDocumentApi("doc/1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/documents/doc%2F1", expect.objectContaining({ method: "DELETE" }));

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(deleteDocumentApi("doc-2")).resolves.toBeUndefined();
});

it("throws an ApiError with the API detail for failed deletes", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Document locked" }), { status: 409 }));

    const error = await deleteDocumentApi("doc-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Document locked" });
});

it("falls back to the default message when the error body has no string detail", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { complex: true } }), { status: 500 }));
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 500 }));

    await expect(deleteDocumentApi("doc-1")).rejects.toMatchObject({ message: "Failed to delete document", status: 500 });
    await expect(deleteDocumentApi("doc-1")).rejects.toMatchObject({ message: "Failed to delete document", status: 500 });
});

it.each([true, false])("resubmits a flagged file only when confirmed (save=%s)", async save => {
    const file = new File(["text"], "report.txt");
    const findings = [{ category: "phone", kind: "pii", confidence: "likely", count: 1 }];
    fetchMock.mockResolvedValueOnce(
        Response.json(
            { detail: { code: "guardrail_confirmation_required", guardrail: "sensitive_content", fingerprint: "v1-review", findings } },
            { status: 409 }
        )
    );
    fetchMock.mockResolvedValueOnce(Response.json({ id: "saved" }));
    const confirm = vi.fn().mockResolvedValue(save);
    const upload = uploadDocumentApi(file, confirm);
    if (save) {
        await expect(upload).resolves.toEqual({ id: "saved" });
        const body = fetchMock.mock.calls[1][1]?.body as FormData;
        expect(body.get("file")).toBe(file);
        expect(body.get("confirmation_fingerprint")).toBe("v1-review");
    } else {
        await expect(upload).rejects.toMatchObject({ name: "AbortError" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    expect(confirm).toHaveBeenCalledExactlyOnceWith(file.name, findings);
});

it("passes quota conflicts through without prompting", async () => {
    const confirm = vi.fn();
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Library full" }, { status: 409 }));
    await expect(uploadDocumentApi(new File(["x"], "x.txt"), confirm)).rejects.toMatchObject({ status: 409, message: "Library full" });
    expect(confirm).not.toHaveBeenCalled();
});
