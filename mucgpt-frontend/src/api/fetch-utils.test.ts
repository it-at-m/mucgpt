// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ApiError,
    deleteConfig,
    getHeaders,
    getConfig,
    getXSRFToken,
    handleApiRequest,
    handleRedirect,
    handleResponse,
    patchConfig,
    postConfig,
    postFormDataConfig,
    putConfig
} from "./fetch-utils";

describe("fetch configs", () => {
    afterEach(() => {
        document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    });

    it("builds a GET config with default headers and manual redirect", () => {
        const config = getConfig();
        expect(config.method).toBeUndefined();
        expect(config.mode).toBe("cors");
        expect(config.credentials).toBe("same-origin");
        expect(config.redirect).toBe("manual");
        expect(config.headers).toBeInstanceOf(Headers);
        expect((config.headers as Headers).get("Content-Type")).toBe("application/json");
        expect((config.headers as Headers).get("X-XSRF-TOKEN")).toBeNull();
    });

    it("appends the XSRF token from the cookie to every request config", () => {
        document.cookie = "XSRF-TOKEN=csrf-123; Path=/";
        expect(getXSRFToken()).toBe("csrf-123");
        expect((getHeaders() as Headers).get("X-XSRF-TOKEN")).toBe("csrf-123");
        expect(postConfig().headers as Headers).toHaveProperty("get");
        expect((postConfig().headers as Headers).get("X-XSRF-TOKEN")).toBe("csrf-123");
    });

    it("serializes JSON bodies in POST/PUT/PATCH/DELETE configs", () => {
        const body = { name: "Test" };
        expect(postConfig(body)).toMatchObject({ method: "POST", body: JSON.stringify(body) });
        expect(putConfig(body)).toMatchObject({ method: "PUT", body: JSON.stringify(body) });
        expect(patchConfig(body)).toMatchObject({ method: "PATCH", body: JSON.stringify(body) });
        expect(deleteConfig(body)).toMatchObject({ method: "DELETE", body: JSON.stringify(body) });
        // no body → undefined body
        expect(postConfig().body).toBeUndefined();
        expect(deleteConfig().body).toBeUndefined();
    });

    it("adds an If-Match header when a version is given to PUT/PATCH", () => {
        expect((putConfig({ version: 7 })?.headers as Headers).get("If-Match")).toBe("7");
        expect((patchConfig({ version: "v3" })?.headers as Headers).get("If-Match")).toBe("v3");
        expect((putConfig({ name: "x" })?.headers as Headers).get("If-Match")).toBeNull();
        expect((putConfig()?.headers as Headers).get("If-Match")).toBeNull();
    });

    it("does not set Content-Type for FormData uploads but keeps the CSRF token", () => {
        document.cookie = "XSRF-TOKEN=form-csrf; Path=/";
        const config = postFormDataConfig(new FormData());
        expect(config.method).toBe("POST");
        expect(config.body).toBeInstanceOf(FormData);
        expect((config.headers as Headers).get("Content-Type")).toBeNull();
        expect((config.headers as Headers).get("X-XSRF-TOKEN")).toBe("form-csrf");
    });
});

describe("handleRedirect", () => {
    it("ignores ordinary responses", () => {
        expect(() => handleRedirect(new Response(null, { status: 200 }))).not.toThrow();
    });

    it("throws and schedules a reload for an opaque redirect", () => {
        vi.useFakeTimers();
        const reload = vi.fn();
        Object.defineProperty(window, "location", { value: { reload }, writable: true, configurable: true });
        const response = new Response(null, { status: 302 });
        Object.defineProperty(response, "type", { value: "opaqueredirect" });

        expect(() => handleRedirect(response)).toThrow("Die Authentifizierungsinformationen sind abgelaufen");
        vi.advanceTimersByTime(5000);
        expect(reload).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it("navigates to the redirect URL when reload is disabled", () => {
        Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
        const response = new Response(null, { status: 302 });
        Object.defineProperty(response, "type", { value: "opaqueredirect" });
        Object.defineProperty(response, "url", { value: "https://sso.example.org/login" });

        handleRedirect(response, false);
        expect(window.location.href).toBe("https://sso.example.org/login");
    });

    it("throws when an opaque redirect without URL cannot be followed", () => {
        const response = new Response(null, { status: 302 });
        Object.defineProperty(response, "type", { value: "opaqueredirect" });
        expect(() => handleRedirect(response, false)).toThrow("Redirect URL not found");
    });
});

describe("handleResponse", () => {
    it("returns the parsed JSON body for ok responses", async () => {
        const response = new Response(JSON.stringify({ value: 42 }), { status: 200 });
        await expect(handleResponse(response)).resolves.toEqual({ value: 42 });
    });

    it("reports the HTTP status for error responses (the API detail is swallowed by the catch)", async () => {
        const response = new Response(JSON.stringify({ detail: "Invalid input" }), { status: 422 });
        await expect(handleResponse(response)).rejects.toThrow("Request failed with status 422");
    });

    it("reports the HTTP status even when the body carries error/detail fields", async () => {
        const response = new Response(JSON.stringify({ error: "Server error", detail: "ignored" }), { status: 500 });
        await expect(handleResponse(response)).rejects.toThrow("Request failed with status 500");

        const generic = new Response("{}", { status: 503 });
        await expect(handleResponse(generic)).rejects.toThrow("Request failed with status 503");
    });

    it("falls back to a status message when the body is not JSON", async () => {
        const response = new Response("<html>", { status: 502 });
        await expect(handleResponse(response)).rejects.toThrow("Request failed with status 502");
    });

    it("reports a JSON parse failure for ok responses with an invalid body", async () => {
        const response = new Response("not-json", { status: 200 });
        await expect(handleResponse(response)).rejects.toThrow("Failed to parse response as JSON");
    });
});

describe("handleApiRequest", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns the parsed response body on success", async () => {
        await expect(handleApiRequest(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }), "Failed")).resolves.toEqual({ ok: true });
    });

    it("throws an ApiError carrying the API detail string", async () => {
        const promise = handleApiRequest(async () => new Response(JSON.stringify({ detail: "Nope" }), { status: 404 }), "Failed to load");
        await expect(promise).rejects.toMatchObject({ name: "ApiError", status: 404, message: "Nope" });
    });

    it("unwraps detail objects with message and redirect_url", async () => {
        const detail = { message: "Gone", redirect_url: "/somewhere" };
        const promise = handleApiRequest(async () => new Response(JSON.stringify({ detail }), { status: 410 }), "Failed to load");
        await expect(promise).rejects.toMatchObject({ message: "Gone", redirectUrl: "/somewhere", status: 410 });
    });

    it("keeps detail.redirect_url when detail has no message", async () => {
        const detail = { redirect_url: "/relogin" };
        const promise = handleApiRequest(async () => new Response(JSON.stringify({ detail }), { status: 401 }), "Failed to load");
        await expect(promise).rejects.toMatchObject({
            message: "Failed to load: ",
            redirectUrl: "/relogin",
            status: 401
        });
    });

    it("uses the default message with statusText when the body has neither message nor detail", async () => {
        const promise = handleApiRequest(async () => new Response(null, { status: 500, statusText: "Boom" }), "Failed to load");
        await expect(promise).rejects.toMatchObject({ message: "Failed to load: Boom", status: 500 });
    });

    it("prefers the API message over the default", async () => {
        const promise = handleApiRequest(async () => new Response(JSON.stringify({ message: "Custom" }), { status: 500 }), "Failed to load");
        await expect(promise).rejects.toMatchObject({ message: "Custom" });
    });

    it("rethrows ApiError and Error instances unchanged and wraps non-Error throwables", async () => {
        const apiError = new ApiError("explicit", 400);
        await expect(handleApiRequest(() => Promise.reject(apiError), "Failed")).rejects.toBe(apiError);

        const error = new Error("network down");
        await expect(handleApiRequest(() => Promise.reject(error), "Failed")).rejects.toBe(error);

        await expect(handleApiRequest(() => Promise.reject("boom"), "Failed to do it")).rejects.toThrow("An unexpected error occurred: failed to do it");
    });
});
