// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getUser } from "./user-client";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

it("requests the userinfo endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sub: "u-1" }), { status: 200 }));
    await getUser();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/sso/userinfo", expect.objectContaining({ mode: "cors" }));
});

it("maps the raw userinfo to the normalized User shape", async () => {
    fetchMock.mockResolvedValue(
        new Response(
            JSON.stringify({
                sub: "sub-1",
                name: "Max Mustermann",
                family_name: "Mustermann",
                given_name: "Max",
                middle_name: "M",
                email: "max@muenchen.de",
                preferred_username: "maxm",
                organization_unit: "IT",
                user_id: "uid-9",
                resource_access: { mucgpt: { roles: ["mucgpt-user", "mucgpt-admin"] } }
            }),
            { status: 200 }
        )
    );

    const user = await getUser();

    expect(user).toEqual({
        sub: "sub-1",
        name: "Max Mustermann",
        family_name: "Mustermann",
        given_name: "Max",
        middle_name: "M",
        email: "max@muenchen.de",
        preferred_username: "maxm",
        organization_unit: "IT",
        user_id: "uid-9",
        roles: ["mucgpt-user", "mucgpt-admin"]
    });
});

it("deduplicates roles and ignores non-string entries", async () => {
    fetchMock.mockResolvedValue(
        new Response(
            JSON.stringify({
                resource_access: { mucgpt: { roles: ["mucgpt-user", 42, "mucgpt-user", null, "mucgpt-admin"] } }
            }),
            { status: 200 }
        )
    );

    const user = await getUser();
    expect(user.roles).toEqual(["mucgpt-user", "mucgpt-admin"]);
});

it("returns empty strings and no roles when claims are missing", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const user = await getUser();

    expect(user.sub).toBe("");
    expect(user.name).toBe("");
    expect(user.organization_unit).toBe("");
    expect(user.roles).toEqual([]);
});

it("does not read roles from foreign resource_access clients", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ resource_access: { other_client: { roles: ["sneaky"] } } }), { status: 200 }));

    const user = await getUser();
    expect(user.roles).toEqual([]);
});
