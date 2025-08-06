import { getConfig, handleRedirect, handleResponse } from "./fetch-utils";
import { User } from "./models";

export async function getUser(): Promise<User> {
    const response = await fetch("/api/sso/userinfo", getConfig());
    handleRedirect(response, true);
    const json: Partial<User> = await handleResponse(response);
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
