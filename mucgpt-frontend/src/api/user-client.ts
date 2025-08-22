import { getConfig, handleApiRequest } from "./fetch-utils";
import { User } from "./models";

export async function getUser(): Promise<User> {
    const json: Partial<User> = await handleApiRequest(() => fetch("/api/sso/userinfo", getConfig()), "Failed to get user information");

    const u: Partial<User> = {};
    u.sub = json.sub || "";

    // LHM
    u.displayName = json.displayName || "";
    u.surname = json.surname || "";
    u.telephoneNumber = json.telephoneNumber || "";
    u.email = json.email || "";
    u.username = json.username || "";
    u.givenname = json.givenname || "";
    u.department = json.department || "";
    u.lhmObjectID = json.lhmObjectID || "";

    // LHM_Extended
    u.preferred_username = json.preferred_username || "";
    u.memberof = json.memberof || [];
    u.user_roles = json.user_roles || [];
    u.authorities = json.authorities || [];
    return u;
}
