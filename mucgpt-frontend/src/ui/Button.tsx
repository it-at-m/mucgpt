import { forwardRef, useContext } from "react";
import { Button as FluentButton, buttonClassNames, type ButtonProps, makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";

import { AppThemeContext } from "./theme/AppThemeContext";

type ButtonTone = "danger" | "muted";
type MucgptButtonProps = ButtonProps & { tone?: ButtonTone };

const useStyles = makeStyles({
    darkSubtle: {
        color: tokens.colorNeutralForeground1,
        ":hover": {
            color: tokens.colorNeutralForeground1,
            [`& .${buttonClassNames.icon}`]: {
                color: tokens.colorNeutralForeground1
            }
        },
        ":hover:active, :active:focus-visible": {
            color: tokens.colorNeutralForeground1,
            [`& .${buttonClassNames.icon}`]: {
                color: tokens.colorNeutralForeground1
            }
        }
    },
    danger: {
        color: tokens.colorStatusDangerForeground1,
        ...shorthands.borderColor(tokens.colorStatusDangerBorder1),
        [`& .${buttonClassNames.icon}`]: {
            color: tokens.colorStatusDangerForeground1
        },
        ":hover, :hover:active": {
            color: tokens.colorStatusDangerForeground1,
            ...shorthands.borderColor(tokens.colorStatusDangerBorder2),
            [`& .${buttonClassNames.icon}`]: {
                color: tokens.colorStatusDangerForeground1
            }
        }
    },
    // "Temporarily unavailable" action: recedes like a disabled control but remains
    // clickable because the click opens a setup panel (e.g. transcription model download).
    // NeutralForeground3 (instead of the disabled token) keeps the unlabeled icon at
    // sufficient contrast under the busy opacity in both themes.
    muted: {
        color: tokens.colorNeutralForeground3,
        [`& .${buttonClassNames.icon}`]: {
            color: tokens.colorNeutralForeground3
        },
        ":hover, :hover:active": {
            color: tokens.colorNeutralForeground3,
            [`& .${buttonClassNames.icon}`]: {
                color: tokens.colorNeutralForeground3
            }
        }
    }
});

export const Button = forwardRef<HTMLButtonElement, MucgptButtonProps>(({ appearance, className, disabled, disabledFocusable, tone, ...props }, ref) => {
    const { isLight } = useContext(AppThemeContext);
    const styles = useStyles();
    const isEnabled = !disabled && !disabledFocusable;
    const useDarkSubtleForeground = !isLight && appearance === "subtle" && isEnabled;

    return (
        <FluentButton
            {...props}
            ref={ref}
            appearance={appearance}
            disabled={disabled}
            disabledFocusable={disabledFocusable}
            className={mergeClasses(
                useDarkSubtleForeground && styles.darkSubtle,
                isEnabled && tone === "danger" && styles.danger,
                isEnabled && tone === "muted" && styles.muted,
                className
            )}
        />
    );
});

Button.displayName = "Button";
