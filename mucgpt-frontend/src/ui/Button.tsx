import { forwardRef, useContext } from "react";
import { Button as FluentButton, buttonClassNames, type ButtonProps, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import { LightContext } from "../pages/layout/LightContext";

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
    }
});

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ appearance, className, disabled, disabledFocusable, ...props }, ref) => {
    const isLight = useContext(LightContext);
    const styles = useStyles();
    const useDarkSubtleForeground = !isLight && appearance === "subtle" && !disabled && !disabledFocusable;

    return (
        <FluentButton
            {...props}
            ref={ref}
            appearance={appearance}
            disabled={disabled}
            disabledFocusable={disabledFocusable}
            className={mergeClasses(useDarkSubtleForeground && styles.darkSubtle, className)}
        />
    );
});

Button.displayName = "Button";
