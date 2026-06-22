import { Avatar, Popover, PopoverSurface, PopoverTrigger, Tooltip } from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { User } from "../../api/models";
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

const normalizeValue = (value?: string) => value?.trim().replace(/\s+/g, " ") ?? "";

const getInitialsFromName = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase() || "??";
    }

    const singleName = parts[0] ?? "";
    return singleName.slice(0, 2).toUpperCase() || "??";
};

const getPreferredNameSource = (user: User | null) => {
    const name = normalizeValue(user?.name);
    if (name) {
        return name;
    }

    const givenName = normalizeValue(user?.given_name);
    if (givenName) {
        return givenName;
    }

    return "";
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

export const UserSidebarProfile = ({ collapsed, isMobile, utilitiesContent, popoverClassName, utilitiesContentClassName }: UserSidebarProfileProps) => {
    const { t } = useTranslation();
    const { user } = useContext(UserContext);
    const fallbackName = t("common.user", "User");

    const userProfile = useMemo(() => deriveUserProfile(user, fallbackName), [user, fallbackName]);
    const tooltipLabel = useMemo(() => getPreferredNameSource(user) || userProfile.displayName, [user, userProfile.displayName]);
    const isCollapsed = collapsed && !isMobile;
    const triggerClassName = `${styles.triggerButton} ${isCollapsed ? styles.triggerButtonCollapsed : ""}`;

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
    const popoverSurfaceRef = useRef<HTMLDivElement | null>(null);
    const wasPopoverOpenRef = useRef(false);

    useEffect(() => {
        if (isPopoverOpen) {
            popoverSurfaceRef.current?.focus();
        } else if (wasPopoverOpenRef.current) {
            triggerButtonRef.current?.focus();
        }

        wasPopoverOpenRef.current = isPopoverOpen;
    }, [isPopoverOpen]);

    const avatar = <Avatar className={styles.avatarFallback} name={userProfile.initials} aria-hidden="true" />;

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
