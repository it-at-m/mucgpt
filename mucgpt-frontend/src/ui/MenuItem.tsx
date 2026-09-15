import { forwardRef, useContext } from "react";
import {
    MenuItem as FluentMenuItem,
    MenuItemLink as FluentMenuItemLink,
    menuItemClassNames,
    type MenuItemLinkProps,
    type MenuItemProps,
    makeStyles,
    mergeClasses,
    tokens
} from "@fluentui/react-components";

import { LightContext } from "../pages/layout/LightContext";

const useStyles = makeStyles({
    subtle: {
        backgroundColor: tokens.colorSubtleBackground,
        ":hover": {
            backgroundColor: tokens.colorSubtleBackgroundHover
        },
        ":hover:active": {
            backgroundColor: tokens.colorSubtleBackgroundPressed
        },
        '&[aria-expanded="true"]': {
            backgroundColor: tokens.colorSubtleBackgroundHover
        }
    },
    darkForeground: {
        color: tokens.colorNeutralForeground1,
        ":hover, :hover:active": {
            color: tokens.colorNeutralForeground1,
            [`& .${menuItemClassNames.icon}`]: {
                color: tokens.colorNeutralForeground1
            }
        },
        '&[aria-expanded="true"]': {
            color: tokens.colorNeutralForeground1,
            [`& .${menuItemClassNames.icon}`]: {
                color: tokens.colorNeutralForeground1
            }
        }
    }
});

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(({ className, disabled, ...props }, ref) => {
    const isLight = useContext(LightContext);
    const styles = useStyles();

    return (
        <FluentMenuItem
            {...props}
            ref={ref}
            disabled={disabled}
            className={mergeClasses(!disabled && styles.subtle, !isLight && !disabled && styles.darkForeground, className)}
        />
    );
});

export const MenuItemLink = forwardRef<HTMLAnchorElement, MenuItemLinkProps>(({ className, disabled, ...props }, ref) => {
    const isLight = useContext(LightContext);
    const styles = useStyles();

    return (
        <FluentMenuItemLink
            {...props}
            ref={ref}
            disabled={disabled}
            className={mergeClasses(!disabled && styles.subtle, !isLight && !disabled && styles.darkForeground, className)}
        />
    );
});

MenuItem.displayName = "MenuItem";
MenuItemLink.displayName = "MenuItemLink";
