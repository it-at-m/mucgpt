import { forwardRef } from "react";
import { Option as FluentOption, type OptionProps, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    subtle: {
        backgroundColor: tokens.colorSubtleBackground,
        ":hover": {
            backgroundColor: tokens.colorSubtleBackgroundHover
        },
        ":hover:active": {
            backgroundColor: tokens.colorSubtleBackgroundPressed
        }
    }
});

/** A Fluent dropdown option with the product's subtle interaction treatment. */
export const Option = forwardRef<HTMLDivElement, OptionProps>(({ className, disabled, ...props }, ref) => {
    const styles = useStyles();

    return <FluentOption {...props} ref={ref} disabled={disabled} className={mergeClasses(!disabled && styles.subtle, className)} />;
});

Option.displayName = "Option";
