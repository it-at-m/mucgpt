/**
 * Returns a default GET-Config for fetch
 */
export function getConfig(): RequestInit {
    return {
        headers: getHeaders(),
        mode: "cors",
        credentials: "same-origin",
        redirect: "manual"
    };
}

/**
 * Returns a default POST-Config for fetch
 * @param body Optional body to be transferred
 */
// eslint-disable-next-line
export function postConfig(body: any): RequestInit {
    return {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        headers: getHeaders(),
        mode: "cors",
        credentials: "same-origin",
        redirect: "manual"
    };
}

/**
 * Returns a default PUT-Config for fetch
 * If available, the version of the entity to be updated is included in this as an "If-Match" header.
 * @param body Optional body to be transferred
 */
// eslint-disable-next-line
export function putConfig(body: any): RequestInit {
    const headers = getHeaders();
    if (body.version) {
        headers.append("If-Match", body.version);
    }
    return {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
        headers,
        mode: "cors",
        credentials: "same-origin",
        redirect: "manual"
    };
}

/**
 * Returns a default PATCH-Config for fetch
 * If available, the version of the entity to be updated is included in this as an "If-Match" header.
 * @param body Optional body to be transferred
 */
// eslint-disable-next-line
export function patchConfig(body: any): RequestInit {
    const headers = getHeaders();
    if (body.version !== undefined) {
        headers.append("If-Match", body.version);
    }
    return {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
        headers,
        mode: "cors",
        credentials: "same-origin",
        redirect: "manual"
    };
}

export function handleRedirect(response: Response, reload = true) {
    if (response.type === "opaqueredirect") {
        if (reload) {
            console.log("reloading shortly");
            setTimeout(() => {
                location.reload();
            }, 5000);
            throw Error("Die Authentifizierungsinformationen sind abgelaufen. Die Seite wird in wenigen Sekunden neu geladen.");
        } else {
            const redirectUrl = response.url;
            if (redirectUrl) {
                window.location.href = redirectUrl; // Manually redirect
            } else {
                throw new Error("Redirect URL not found");
            }
        }
    }
}

export async function handleResponse(response: Response) {
    const parsedResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || parsedResponse.detail || "Unknown error");
    }
    return parsedResponse;
}

/**
 * Builds the headers for the request.
 * @returns {Headers}
 */
function getHeaders(): Headers {
    const headers = new Headers({
        "Content-Type": "application/json"
    });
    const csrfCookie = getXSRFToken();
    if (csrfCookie !== "") {
        headers.append("X-XSRF-TOKEN", csrfCookie);
    }
    return headers;
}

/**
 * Returns the XSRF-TOKEN.
 * @returns {string|string}
 */
function getXSRFToken(): string {
    const help = document.cookie.match("(^|;)\\s*" + "XSRF-TOKEN" + "\\s*=\\s*([^;]+)");
    return (help ? help.pop() : "") as string;
}
