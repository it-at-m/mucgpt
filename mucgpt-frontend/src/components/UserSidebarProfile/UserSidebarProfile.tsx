import { Popover, PopoverSurface, PopoverTrigger, Tooltip } from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { User } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import { UserContext } from "../../pages/layout/UserContextProvider";
import styles from "./UserSidebarProfile.module.css";

interface UserSidebarProfileProps {
    collapsed: boolean;
    isMobile: boolean;
    utilitiesContent: ReactNode;
    popoverClassName: string;
    utilitiesContentClassName: string;
}

interface DerivedUserProfile {
    displayName: string;
    firstName: string;
    initials: string;
}

async function sha256Hex(input: string): Promise<string> {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim().toLowerCase()));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

const normalizeValue = (value?: string) => value?.trim().replace(/\s+/g, " ") ?? "";

const getPreferredNameSource = (user: User | null) => {
    const displayName = normalizeValue(user?.displayName);
    if (displayName) {
        return displayName;
    }

    const givenName = normalizeValue(user?.givenname);
    if (givenName) {
        return givenName;
    }

    return normalizeValue(user?.username);
};

const getUsernameInitials = (username: string) => {
    const alphanumericCharacters = Array.from(username.replace(/[^a-zA-Z0-9]/g, ""));
    return alphanumericCharacters.slice(0, 2).join("").toUpperCase();
};

const deriveUserProfile = (user: User | null, fallbackName: string): DerivedUserProfile => {
    const displayName = normalizeValue(user?.displayName);
    if (displayName) {
        const parts = displayName.split(" ").filter(Boolean);
        if (parts.length >= 2) {
            return {
                displayName,
                firstName: parts[0],
                initials: `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase() || "??"
            };
        }

        const singleName = parts[0] ?? "";
        return {
            displayName,
            firstName: singleName || fallbackName,
            initials: singleName.slice(0, 2).toUpperCase() || "??"
        };
    }

    const givenName = normalizeValue(user?.givenname);
    if (givenName) {
        return {
            displayName: givenName,
            firstName: givenName,
            initials: givenName.slice(0, 2).toUpperCase() || "??"
        };
    }

    const username = normalizeValue(user?.username);
    if (username) {
        return {
            displayName: username,
            firstName: username,
            initials: getUsernameInitials(username) || "??"
        };
    }

    return {
        displayName: fallbackName,
        firstName: fallbackName,
        initials: "??"
    };
};

export const UserSidebarProfile = ({ collapsed, isMobile, utilitiesContent, popoverClassName, utilitiesContentClassName }: UserSidebarProfileProps) => {
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const config = useConfigContext();
    const fallbackName = t("common.user", "User");

    const userProfile = useMemo(() => deriveUserProfile(user, fallbackName), [user, fallbackName]);
    const tooltipLabel = useMemo(() => getPreferredNameSource(user) || userProfile.displayName, [user, userProfile.displayName]);
    const isCollapsed = collapsed && !isMobile;
    const triggerClassName = `${styles.triggerButton} ${isCollapsed ? styles.triggerButtonCollapsed : ""}`;

    const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
    const popoverSurfaceRef = useRef<HTMLDivElement | null>(null);
    const wasPopoverOpenRef = useRef(false);
    const handleImgError = useCallback(() => setImgError(true), []);

    useEffect(() => {
        const email = user?.email;
        const baseUrl = config.ad2image_url;
        if (!email || !baseUrl) {
            setGravatarUrl(null);
            return;
        }

        let isCurrent = true;
        setImgError(false);
        sha256Hex(email)
            .then(hash => {
                if (isCurrent) {
                    setGravatarUrl(`${baseUrl}/gravatar/${hash}?d=initials&s=40`);
                }
            })
            .catch(() => {
                if (isCurrent) {
                    setGravatarUrl(null);
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [user?.email, config.ad2image_url]);

    useEffect(() => {
        if (isPopoverOpen) {
            popoverSurfaceRef.current?.focus();
        } else if (wasPopoverOpenRef.current) {
            triggerButtonRef.current?.focus();
        }

        wasPopoverOpenRef.current = isPopoverOpen;
    }, [isPopoverOpen]);

    const showImg = gravatarUrl && !imgError;

    const avatar = showImg ? (
        <img src={gravatarUrl} alt="" aria-hidden="true" className={styles.avatar} onError={handleImgError} />
    ) : (
        <div className={styles.avatarFallback} aria-hidden="true">
            {userProfile.initials}
        </div>
    );

    const trigger = (
        <button ref={triggerButtonRef} type="button" className={triggerClassName} aria-label={t("common.settings")}>
            {avatar}
            {!isCollapsed && (
                <>
                    <span className={styles.textBlock}>
                        <span className={styles.name}>{userProfile.firstName}</span>
                    </span>
                    <span className={styles.moreIcon} aria-hidden="true">
                        <MoreHorizontal20Regular />
                    </span>
                </>
            )}
        </button>
    );

    return (
        <Popover
            open={isPopoverOpen}
            onOpenChange={(_, data) => setIsPopoverOpen(data.open)}
            positioning={{ position: "above", align: "start", offset: { mainAxis: 4, crossAxis: -9 } }}
            trapFocus={false}
        >
            <PopoverTrigger disableButtonEnhancement>
                {isCollapsed ? (
                    <Tooltip content={tooltipLabel} relationship="description" positioning="after">
                        {trigger}
                    </Tooltip>
                ) : (
                    trigger
                )}
            </PopoverTrigger>
            <PopoverSurface ref={popoverSurfaceRef} className={popoverClassName} tabIndex={-1}>
                <div className={utilitiesContentClassName}>{utilitiesContent}</div>
            </PopoverSurface>
        </Popover>
    );
};

export default UserSidebarProfile;
