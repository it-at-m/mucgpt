import { getConfig, handleApiRequest } from "./fetch-utils";
import { User } from "./models";

interface RawUserInfo {
    sub?: string;
    name?: string;
    family_name?: string;
    given_name?: string;
    middle_name?: string;
    email?: string;
    preferred_username?: string;
    department?: string;
    lhmObjectID?: string;
    resource_access?: unknown;
}

const toStringValue = (value: unknown): string => (typeof value === "string" ? value : "");

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const getRoles = (userinfo: RawUserInfo): string[] => {
    const resourceAccess = userinfo.resource_access;
    const mucgptRoles =
        resourceAccess && typeof resourceAccess === "object" && "mucgpt" in resourceAccess
            ? toStringArray((resourceAccess.mucgpt as { roles?: unknown }).roles)
            : [];

    return [...new Set(mucgptRoles)];
};

export async function getUser(): Promise<User> {
    const json: RawUserInfo = await handleApiRequest(() => fetch("/api/sso/userinfo", getConfig()), "Failed to get user information");

    return {
        sub: toStringValue(json.sub),
        name: toStringValue(json.name),
        family_name: toStringValue(json.family_name),
        given_name: toStringValue(json.given_name),
        middle_name: toStringValue(json.middle_name),
        email: toStringValue(json.email),
        preferred_username: toStringValue(json.preferred_username),
        department: toStringValue(json.department),
        lhmObjectID: toStringValue(json.lhmObjectID),
        roles: getRoles(json)
    };
}
