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

import { AppThemeContext } from "./theme/AppThemeContext";

type MenuItemTone = "danger";
type MucgptMenuItemProps = MenuItemProps & { tone?: MenuItemTone };
type MucgptMenuItemLinkProps = MenuItemLinkProps & { tone?: MenuItemTone };

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
    },
    danger: {
        color: tokens.colorStatusDangerForeground1,
        [`& .${menuItemClassNames.icon}`]: {
            color: tokens.colorStatusDangerForeground1
        },
        ":hover, :hover:active": {
            color: tokens.colorStatusDangerForeground1,
            [`& .${menuItemClassNames.icon}`]: {
                color: tokens.colorStatusDangerForeground1
            }
        }
    }
});

export const MenuItem = forwardRef<HTMLDivElement, MucgptMenuItemProps>(({ className, disabled, tone, ...props }, ref) => {
    const { isLight } = useContext(AppThemeContext);
    const styles = useStyles();

    return (
        <FluentMenuItem
            {...props}
            ref={ref}
            disabled={disabled}
            className={mergeClasses(
                !disabled && styles.subtle,
                !isLight && !disabled && styles.darkForeground,
                !disabled && tone === "danger" && styles.danger,
                className
            )}
        />
    );
});

export const MenuItemLink = forwardRef<HTMLAnchorElement, MucgptMenuItemLinkProps>(({ className, disabled, tone, ...props }, ref) => {
    const { isLight } = useContext(AppThemeContext);
    const styles = useStyles();

    return (
        <FluentMenuItemLink
            {...props}
            ref={ref}
            disabled={disabled}
            className={mergeClasses(
                !disabled && styles.subtle,
                !isLight && !disabled && styles.darkForeground,
                !disabled && tone === "danger" && styles.danger,
                className
            )}
        />
    );
});

MenuItem.displayName = "MenuItem";
MenuItemLink.displayName = "MenuItemLink";
