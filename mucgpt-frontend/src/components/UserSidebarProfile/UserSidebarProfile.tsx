import { Avatar, Body1Strong, Button, Menu, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { ReactNode, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { User } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { UserContext } from "../../pages/layout/UserContextProvider";
import styles from "./UserSidebarProfile.module.css";
import itemStyles from "../AppSidebar/SidebarItem.module.css";

interface UserSidebarProfileProps {
    collapsed: boolean;
    isMobile: boolean;
    utilitiesContent: ReactNode;
    popoverClassName: string;
}

interface DerivedUserProfile {
    displayName: string;
    firstName: string;
    initials: string;
}

const normalizeValue = (value?: string) => value?.trim().replace(/\s+/g, " ") ?? "";

const normalizeUidPart = (value?: string) => normalizeValue(value).toLowerCase().replace(/\s+/g, "");

const getInitialsFromName = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase() || "??";
    }

    const singleName = parts[0] ?? "";
    return singleName.slice(0, 2).toUpperCase() || "??";
};

const getPreferredAvatarUid = (user: User | null) => {
    const preferredUsername = normalizeUidPart(user?.preferred_username);
    if (preferredUsername) {
        return preferredUsername.includes("@") ? preferredUsername.split("@")[0] : preferredUsername;
    }

    const givenName = normalizeUidPart(user?.given_name);
    const familyName = normalizeUidPart(user?.family_name);
    if (givenName && familyName) {
        return `${givenName}.${familyName}`;
    }

    const emailPrefix = normalizeUidPart(user?.email).split("@")[0] ?? "";
    if (emailPrefix) {
        return emailPrefix;
    }

    return "";
};

const buildAvatarUrl = (baseUrl: string, uid: string) => {
    const normalizedBaseUrl = normalizeValue(baseUrl);
    if (!normalizedBaseUrl || !uid) {
        return "";
    }

    try {
        const url = new URL(normalizedBaseUrl);
        if (!url.pathname.toLowerCase().includes("/avatar")) {
            const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
            url.pathname = `${pathname}/avatar`;
        }
        url.searchParams.set("uid", uid);
        return url.toString();
    } catch {
        const [rawPath, rawQuery = ""] = normalizedBaseUrl.split("?", 2);
        const hasAvatarPath = /\/avatar\/?$/i.test(rawPath);
        const pathWithAvatar = hasAvatarPath ? rawPath : `${rawPath.replace(/\/$/, "")}/avatar`;
        const queryParams = new URLSearchParams(rawQuery);
        queryParams.set("uid", uid);
        const queryString = queryParams.toString();
        return queryString ? `${pathWithAvatar}?${queryString}` : pathWithAvatar;
    }
};

const deriveUserProfile = (user: User | null, fallbackName: string): DerivedUserProfile => {
    const name = normalizeValue(user?.name);
    if (name) {
        return {
            displayName: name,
            firstName: name.split(" ")[0] || fallbackName,
            initials: getInitialsFromName(name)
        };
    }

    const givenName = normalizeValue(user?.given_name);
    if (givenName) {
        const familyName = normalizeValue(user?.family_name);
        const fullName = `${givenName}${familyName ? ` ${familyName}` : ""}`;
        return {
            displayName: fullName,
            firstName: givenName,
            initials: getInitialsFromName(fullName)
        };
    }

    return {
        displayName: fallbackName,
        firstName: fallbackName,
        initials: "??"
    };
};

export const UserSidebarProfile = ({ collapsed, isMobile, utilitiesContent, popoverClassName }: UserSidebarProfileProps) => {
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const config = useConfigContext();
    const fallbackName = t("common.my_profile", "My Profile");

    const userProfile = useMemo(() => deriveUserProfile(user, fallbackName), [user, fallbackName]);
    const avatarUid = useMemo(() => getPreferredAvatarUid(user), [user]);
    const avatarImageUrl = useMemo(() => buildAvatarUrl(config.ad2image_url ?? "", avatarUid), [config.ad2image_url, avatarUid]);
    const isCollapsed = collapsed && !isMobile;
    const triggerClassName = `${itemStyles.control} ${isCollapsed ? itemStyles.collapsed : ""}`;

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const avatar = (
        <Avatar
            color="brand"
            size={32}
            name={userProfile.displayName}
            initials={{ className: styles.avatarInitials }}
            image={avatarImageUrl ? { src: avatarImageUrl, alt: userProfile.displayName } : undefined}
            aria-hidden="true"
        />
    );

    const trigger = (
        <Button
            appearance="subtle"
            className={triggerClassName}
            aria-label={t("common.settings")}
            icon={{ className: itemStyles.icon, children: avatar }}
        >
            <span className={itemStyles.label} aria-hidden={isCollapsed}>
                <Body1Strong block className={itemStyles.text}>
                    {userProfile.firstName}
                </Body1Strong>
            </span>
        </Button>
    );

    return (
        <Menu open={isMenuOpen} onOpenChange={(_, data) => setIsMenuOpen(data.open)} positioning={{ position: "above", align: "start" }}>
            <MenuTrigger disableButtonEnhancement>{trigger}</MenuTrigger>
            <MenuPopover className={popoverClassName}>
                <MenuList>{utilitiesContent}</MenuList>
            </MenuPopover>
        </Menu>
    );
};

export default UserSidebarProfile;
